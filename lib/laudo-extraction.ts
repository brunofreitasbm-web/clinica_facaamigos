// lib/laudo-extraction.ts
// Agente de leitura de laudo: quando o bot de acolhimento (lib/twilio-
// intake-bot.ts) recebe um arquivo pelo WhatsApp, este módulo lê o
// documento com o Gemini e extrai os campos que alimentam o prontuário
// (número do laudo, validade, CID, exceções, quantidades de sessão) mais um
// resumo em texto livre — o laudo não é padronizado entre profissionais/
// convênios, então quem valida de verdade é sempre o supervisor na tela de
// acolhimento (app/supervisao/acolhimento-lead-drawer.tsx). Mesmo padrão de
// lib/document-extraction.ts: inlineData + responseMimeType "application/
// json", temperature baixa, parse defensivo, "sem fallback fabricado" — uma
// falha de rede/parse/chave ausente devolve { success: false, error }.
import { GEMINI_BASE_URL, isGeminiConfigured } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";

const DOCUMENTS_BUCKET = "clinic-documents";

export type LaudoDocumentType = "laudo" | "guia" | "outro";

export type LaudoExtraction = {
  document_type: LaudoDocumentType;
  report_number: string | null;
  report_date: string | null; // ISO yyyy-mm-dd
  valid_until: string | null; // ISO yyyy-mm-dd
  cid: string | null;
  diagnosis_summary: string | null;
  professional_name: string | null;
  professional_register: string | null; // CRM/CRP/CREFITO etc.
  recommended_frequency: string | null; // ex.: "2x por semana"
  recommended_quantity_sessions: number | null;
  exceptions: string[]; // restrições/observações que fogem do padrão (ex.: "não realizar em grupo")
  summary: string; // resumo em 2-5 frases do conteúdo do laudo, pra revisão rápida
  confidence: Record<string, number>;
  warnings: string[];
};

export type LaudoExtractionOutcome =
  | { success: true; result: LaudoExtraction; model: string }
  | { success: false; error: string };

const DOC_TYPES: LaudoDocumentType[] = ["laudo", "guia", "outro"];

function buildPrompt(): string {
  return `Você recebe um arquivo (foto ou PDF) enviado por um responsável pelo WhatsApp, no acolhimento de uma clínica de desenvolvimento infantil (TEA/terapias). Pode ser um laudo médico/psicológico, uma guia de autorização de plano de saúde, ou outro documento.

Extraia SOMENTE o que estiver legível. Use null quando não encontrar ou não tiver certeza — NUNCA invente um valor. Regras de formato:
- Datas sempre em "YYYY-MM-DD".
- "recommended_quantity_sessions" um número inteiro (quantidade de sessões/atendimentos recomendados ou autorizados no documento), ou null.
- "exceptions": lista de restrições, ressalvas ou observações específicas do documento que fogem do padrão (ex.: "não indicar atendimento em grupo", "reavaliar em 6 meses", "sessões apenas com fonoaudiólogo"). Lista vazia se não houver nenhuma.
- "summary": resumo em português, em 2 a 5 frases, do conteúdo do documento — isto deve funcionar como um resumo clínico rápido pra quem não vai abrir o arquivo original, já que laudos não seguem um formato padronizado entre profissionais/convênios.

Responda APENAS um JSON com exatamente este formato:
{
  "document_type": "laudo"|"guia"|"outro",
  "report_number": string|null,
  "report_date": string|null,
  "valid_until": string|null,
  "cid": string|null,
  "diagnosis_summary": string|null,
  "professional_name": string|null,
  "professional_register": string|null,
  "recommended_frequency": string|null,
  "recommended_quantity_sessions": number|null,
  "exceptions": [string],
  "summary": string,
  "confidence": {"report_number": number, "...": number},
  "warnings": [string]
}
Preencha "confidence" (0 a 1) para cada campo não-nulo que você preencheu (chave = nome do campo). Em "warnings", liste inconsistências ou dúvidas (ex.: documento parcialmente ilegível, data de validade ausente). Responda só o JSON, sem texto adicional.`;
}

function coerceString(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function coerceNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function coerceDocType(v: unknown): LaudoDocumentType {
  return typeof v === "string" && (DOC_TYPES as string[]).includes(v) ? (v as LaudoDocumentType) : "outro";
}

function coerceExtraction(raw: unknown): LaudoExtraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  const exceptionsRaw = Array.isArray(r.exceptions) ? r.exceptions : [];
  const warningsRaw = Array.isArray(r.warnings) ? r.warnings : [];
  const confidenceRaw = (r.confidence ?? {}) as Record<string, unknown>;

  return {
    document_type: coerceDocType(r.document_type),
    report_number: coerceString(r.report_number),
    report_date: coerceString(r.report_date),
    valid_until: coerceString(r.valid_until),
    cid: coerceString(r.cid),
    diagnosis_summary: coerceString(r.diagnosis_summary),
    professional_name: coerceString(r.professional_name),
    professional_register: coerceString(r.professional_register),
    recommended_frequency: coerceString(r.recommended_frequency),
    recommended_quantity_sessions: coerceNumber(r.recommended_quantity_sessions),
    exceptions: exceptionsRaw.filter((e): e is string => typeof e === "string" && e.trim().length > 0),
    summary: coerceString(r.summary) ?? "",
    confidence: Object.fromEntries(
      Object.entries(confidenceRaw)
        .map(([k, v]) => [k, coerceNumber(v)])
        .filter((e): e is [string, number] => e[1] !== null),
    ),
    warnings: warningsRaw.filter((w): w is string => typeof w === "string"),
  };
}

/**
 * Chama o Gemini com um único arquivo (laudo/guia recebido pelo WhatsApp).
 * Nunca lança — toda falha (chave ausente, HTTP != 200, JSON inválido/vazio)
 * volta como `{ success: false, error }`.
 */
export async function extractLaudoDocument(
  base64: string,
  mimeType: string,
  opts?: { timeoutMs?: number },
): Promise<LaudoExtractionOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !isGeminiConfigured()) {
    return { success: false, error: "GEMINI_API_KEY não configurada." };
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt() }, { inlineData: { mimeType, data: base64 } }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  try {
    const url = `${GEMINI_BASE_URL}?key=${apiKey.trim()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 45_000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[Laudo Extraction Gemini Error ${res.status}]:`, errorText);
      return { success: false, error: `Erro HTTP na API Gemini: ${res.status}` };
    }

    const data = await res.json();
    const jsonText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!jsonText) {
      return { success: false, error: "Resposta vazia retornada pelo Gemini." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { success: false, error: "O Gemini não devolveu um JSON válido." };
    }

    return { success: true, result: coerceExtraction(parsed), model: "gemini" };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[Laudo Extraction Exception]:", errMessage);
    return { success: false, error: errMessage };
  }
}

/**
 * Baixa um arquivo já salvo em `insurance_intake_lead_files`, roda a
 * extração e grava o resultado na própria linha (`extraction`,
 * `extraction_status`, `extracted_at`). Se a IA identificar o documento como
 * laudo e o supervisor ainda não tiver classificado manualmente (`kind`
 * null), já marca `kind='laudo'` — o supervisor pode corrigir na tela.
 *
 * Chamado "fire and forget" pelo bot do WhatsApp assim que o arquivo chega
 * (lib/twilio-intake-bot.ts) e também sob demanda pelo botão "Reprocessar
 * com IA" da tela de acolhimento (reprocessLaudoExtraction, em
 * app/supervisao/acolhimento-actions.ts). Nunca lança — uma falha de
 * download/extração só deixa `extraction_status='failed'` pra reprocessar
 * depois, sem impedir o resto do fluxo do bot.
 */
export async function runLaudoExtraction(fileId: string): Promise<void> {
  const admin = createAdminClient();

  try {
    const { data: file } = await admin
      .from("insurance_intake_lead_files")
      .select("id, storage_path, mime_type, kind")
      .eq("id", fileId)
      .maybeSingle();
    if (!file) return;

    const { data: downloaded, error: downloadError } = await admin.storage.from(DOCUMENTS_BUCKET).download(file.storage_path);
    if (downloadError || !downloaded) {
      await admin.from("insurance_intake_lead_files").update({ extraction_status: "failed", extracted_at: new Date().toISOString() }).eq("id", fileId);
      return;
    }

    const buffer = Buffer.from(await downloaded.arrayBuffer());
    const outcome = await extractLaudoDocument(buffer.toString("base64"), file.mime_type);

    if (!outcome.success) {
      await admin.from("insurance_intake_lead_files").update({ extraction_status: "failed", extracted_at: new Date().toISOString() }).eq("id", fileId);
      return;
    }

    const update: Record<string, unknown> = {
      extraction: outcome.result,
      extraction_status: "done",
      extracted_at: new Date().toISOString(),
    };
    if (!file.kind && outcome.result.document_type !== "outro") {
      update.kind = outcome.result.document_type;
    }

    await admin.from("insurance_intake_lead_files").update(update as never).eq("id", fileId);
  } catch (err) {
    console.error("[Laudo Extraction] Falha ao processar arquivo:", err);
    try {
      await admin.from("insurance_intake_lead_files").update({ extraction_status: "failed", extracted_at: new Date().toISOString() }).eq("id", fileId);
    } catch {
      // já logamos acima — evita que uma segunda falha (ex.: coluna ainda não migrada) suba pro chamador.
    }
  }
}
