// lib/insurance-intake-extraction.ts
// Extração de "acolhimentos oriundos de plano de saúde": um único PDF do
// convênio pode listar dezenas de pacientes encaminhados — diferente de
// lib/document-extraction.ts (um cadastro por chamada), aqui uma chamada ao
// Gemini devolve uma LISTA de linhas (uma por beneficiário). Mesmo padrão de
// "sem fallback fabricado": qualquer falha de rede/parse devolve
// { success: false, error }, nunca um resultado inventado. Os normalizadores
// de lib/document-extraction.ts (CPF, data, telefone, UF, CEP, convênio) são
// reaproveitados linha a linha em vez de duplicados aqui.
import { GEMINI_BASE_URL, isGeminiConfigured } from "@/lib/gemini";
import { normalizeCpf, parseBrDate, normalizePhone, matchInsurer } from "@/lib/document-extraction";
import type { IntakeExtractionProfile } from "@/lib/insurance-intake-profile";

export type IntakeRow = {
  patient_full_name: string | null;
  patient_birth_date: string | null;
  patient_cpf: string | null;
  patient_sexo: "F" | "M" | null;
  patient_cid: string | null;
  guardian_full_name: string | null;
  guardian_cpf: string | null;
  guardian_relationship: string | null;
  guardian_email: string | null;
  guardian_phones: string[];
  card_number: string | null;
  plan_name: string | null;
  card_valid_until: string | null;
  guide_number: string | null;
  procedure_code: string | null;
  sessions_authorized: number | null;
  valid_from: string | null;
  valid_to: string | null;
  authorization_password: string | null;
  extra: Record<string, string | null>;
  confidence: Record<string, number>;
  warnings: string[];
};

export type IntakeExtraction = {
  detected_insurer_name: string | null;
  rows: IntakeRow[];
  warnings: string[];
  truncated: boolean;
};

export type IntakeExtractionOutcome =
  | { success: true; result: IntakeExtraction; model: string }
  | { success: false; error: string };

function buildIntakePrompt(insurerNames: string[], profile?: IntakeExtractionProfile): string {
  const profileBlock = profile
    ? [
        profile.layout_hints ? `Dicas do layout deste convênio: ${profile.layout_hints}` : "",
        profile.header_keywords?.length ? `Palavras-chave do cabeçalho: ${profile.header_keywords.join(", ")}` : "",
        profile.columns?.length
          ? `Mapeamento de colunas conhecido (rótulo no PDF → campo estruturado):\n${profile.columns
              .map((c) => `- "${c.label_in_pdf}" → ${c.key}${c.example ? ` (ex.: ${c.example})` : ""}${c.notes ? ` — ${c.notes}` : ""}`)
              .join("\n")}`
          : "",
        profile.date_format ? `Formato de data predominante: ${profile.date_format}` : "",
        profile.phone_notes ? `Observação sobre telefones: ${profile.phone_notes}` : "",
        profile.extra_fields?.length
          ? `Campos extras específicos deste convênio (coloque em "extra", chaveado pelo "key"): ${profile.extra_fields
              .map((f) => `${f.key} (${f.label})`)
              .join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return `Você recebe um PDF enviado por um plano de saúde/convênio (ex: Unimed) para uma clínica de desenvolvimento infantil (TEA/terapias). O PDF é um documento de controle padrão (ex: com título no formato "CONTROLE [NOME DA CLÍNICA] TERAPIAS", onde o nome da clínica pode variar) contendo uma RELAÇÃO/LISTA de pacientes/beneficiários encaminhados, cada um com seu responsável e dados de guia/autorização.

Devolva UMA entrada em "rows" para CADA beneficiário/paciente encontrado no documento — não resuma, não pule nenhuma linha da tabela.

${profileBlock ? `${profileBlock}\n` : ""}
Convênios já cadastrados nesta clínica (preencha "detected_insurer_name" com o nome mais parecido ao que aparece no cabeçalho/timbre do PDF, se identificar um destes): ${insurerNames.length > 0 ? insurerNames.join(", ") : "(nenhum cadastrado ainda)"}.

Extraia SOMENTE o que estiver legível. Use null (ou lista vazia) quando não encontrar ou não tiver certeza — NUNCA invente um valor. Regras de formato:
- Datas sempre em "YYYY-MM-DD".
- CPF só dígitos (sem pontuação).
- "patient_sexo" só "F" ou "M" (null se não achar).
- "guardian_phones": lista com TODOS os telefones da linha, como aparecem no PDF (não normalize aqui).
- "procedure_code": se o PDF listar múltiplas terapias/procedimentos para o mesmo paciente (ex: "FONOAUDIOLOGIA, TERAPIA OCUPACIONAL, PSICOMOTRICIDADE e PSICOLOGIA – ABA"), capture a lista completa de terapias separadas por vírgula ou em "extra.therapies_list".
- "sessions_authorized" um número inteiro ou a soma de sessões autorizadas, ou null.
- Se o documento tiver mais linhas do que você conseguir processar nesta resposta, devolva o máximo possível e marque "truncated": true.

Responda APENAS um JSON com exatamente este formato:
{
  "detected_insurer_name": string|null,
  "truncated": boolean,
  "warnings": [string],
  "rows": [
    {
      "patient_full_name": string|null, "patient_birth_date": string|null, "patient_cpf": string|null,
      "patient_sexo": "F"|"M"|null, "patient_cid": string|null,
      "guardian_full_name": string|null, "guardian_cpf": string|null, "guardian_relationship": string|null,
      "guardian_email": string|null, "guardian_phones": [string],
      "card_number": string|null, "plan_name": string|null, "card_valid_until": string|null,
      "guide_number": string|null, "procedure_code": string|null, "sessions_authorized": number|null,
      "valid_from": string|null, "valid_to": string|null, "authorization_password": string|null,
      "extra": {"<chave>": string|null},
      "confidence": {"patient_full_name": number, "...": number},
      "warnings": [string]
    }
  ]
}
Em "confidence" (0 a 1), preencha uma entrada para cada campo não-nulo que você preencheu NESTA linha (chave = nome do campo, ex. "patient_full_name"). Em "warnings" (por linha e geral), liste inconsistências (ex.: telefone sem DDD, nome ilegível, carteirinha vencida). Responda só o JSON, sem texto adicional.`;
}

function coerceString(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function coerceNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function coerceRow(raw: unknown): IntakeRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sexoRaw = coerceString(r.patient_sexo);
  const confidenceRaw = (r.confidence ?? {}) as Record<string, unknown>;
  const warningsRaw = Array.isArray(r.warnings) ? r.warnings : [];
  const extraRaw = (r.extra ?? {}) as Record<string, unknown>;
  const phonesRaw = Array.isArray(r.guardian_phones) ? r.guardian_phones : [];

  return {
    patient_full_name: coerceString(r.patient_full_name),
    patient_birth_date: coerceString(r.patient_birth_date),
    patient_cpf: coerceString(r.patient_cpf),
    patient_sexo: sexoRaw === "F" || sexoRaw === "M" ? sexoRaw : null,
    patient_cid: coerceString(r.patient_cid),
    guardian_full_name: coerceString(r.guardian_full_name),
    guardian_cpf: coerceString(r.guardian_cpf),
    guardian_relationship: coerceString(r.guardian_relationship),
    guardian_email: coerceString(r.guardian_email),
    guardian_phones: phonesRaw.filter((p): p is string => typeof p === "string" && p.trim().length > 0),
    card_number: coerceString(r.card_number),
    plan_name: coerceString(r.plan_name),
    card_valid_until: coerceString(r.card_valid_until),
    guide_number: coerceString(r.guide_number),
    procedure_code: coerceString(r.procedure_code),
    sessions_authorized: coerceNumber(r.sessions_authorized),
    valid_from: coerceString(r.valid_from),
    valid_to: coerceString(r.valid_to),
    authorization_password: coerceString(r.authorization_password),
    extra: Object.fromEntries(Object.entries(extraRaw).map(([k, v]) => [k, coerceString(v)])),
    confidence: Object.fromEntries(
      Object.entries(confidenceRaw)
        .map(([k, v]) => [k, coerceNumber(v)])
        .filter((e): e is [string, number] => e[1] !== null),
    ),
    warnings: warningsRaw.filter((w): w is string => typeof w === "string"),
  };
}

function coerceIntakeExtraction(raw: unknown): IntakeExtraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(r.rows) ? r.rows : [];
  const warningsRaw = Array.isArray(r.warnings) ? r.warnings : [];
  return {
    detected_insurer_name: coerceString(r.detected_insurer_name),
    rows: rowsRaw.map(coerceRow),
    warnings: warningsRaw.filter((w): w is string => typeof w === "string"),
    truncated: r.truncated === true,
  };
}

export type IntakeFileInput = { base64: string; mimeType: string };

import { extractText } from "unpdf";

/**
 * Tenta extrair nativamente via texto e Regex os beneficiários do PDF digital da Unimed.
 */
async function tryNativePdfRegexExtraction(
  base64: string,
  insurerNames: string[]
): Promise<IntakeExtraction | null> {
  try {
    const buffer = Buffer.from(base64, "base64");
    const { text } = await extractText(new Uint8Array(buffer));
    const fullText = Array.isArray(text) ? text.join("\n") : String(text || "");

    if (!fullText || fullText.trim().length < 20) {
      return null; // PDF é imagem ou scanned (sem texto extraível)
    }

    const rows: IntakeRow[] = [];
    const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Expressões regulares para padrões de relatórios Unimed / Guias TISS
    const cardRegex = /\b(0\s*\d{3}\s*\d{8,12}\s*\d|\d{13,17})\b/;
    const cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
    const phoneRegex = /\(?\d{2}\)?\s*9?\d{4}-?\d{4}/g;
    const dateRegex = /\b\d{2}\/\d{2}\/\d{4}\b/g;
    // Linha da Unimed vem como "<nº sequencial> <terapia> <nome do paciente> ...".
    // O nº sequencial não é dado do paciente; a terapia vai para "procedure_code", não para o nome.
    const leadingSeqRegex = /^\s*\d{1,4}\s*[-.)]?\s*/;
    const therapyNames = [
      "fonoaudiologia",
      "terapia ocupacional",
      "psicomotricidade",
      "psicopedagogia",
      "musicoterapia",
      "fisioterapia",
      "psicologia\\s*[-–]?\\s*aba",
      "psicologia",
      "nutrição",
      "aba",
    ];
    const leadingTherapyRegex = new RegExp(`^\\s*(${therapyNames.join("|")})\\b\\s*[-.)]?\\s*`, "i");

    // Procura o nome do convênio no texto
    let detectedInsurer: string | null = null;
    if (/unimed/i.test(fullText)) {
      detectedInsurer = insurerNames.find((i) => /unimed/i.test(i)) ?? "Unimed";
    }

    // Bloca linhas ou agrupamentos por paciente
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cardMatch = line.match(cardRegex);
      const cpfMatch = line.match(cpfRegex);

      if (cardMatch || cpfMatch) {
        // Encontrou um registro de paciente
        const phones = line.match(phoneRegex) || [];
        const dates = line.match(dateRegex) || [];

        // Tenta capturar nome (fragmento de texto com maiúsculas sem números soltos)
        let namePart = line
          .replace(cardRegex, "")
          .replace(cpfRegex, "")
          .replace(phoneRegex, "")
          .replace(dateRegex, "")
          .replace(/guia|unimed|paciente|controle|terapias/gi, "")
          .trim();

        // Remove o nº sequencial da linha ("1", "2"...) — não é dado do paciente.
        namePart = namePart.replace(leadingSeqRegex, "").trim();

        // Extrai a terapia no início da linha (ex.: "FONOAUDIOLOGIA NOME DO PACIENTE") para o campo de terapia.
        const leadingTherapyMatch = namePart.match(leadingTherapyRegex);
        const detectedTherapy = leadingTherapyMatch ? leadingTherapyMatch[1].trim() : null;
        if (leadingTherapyMatch) {
          namePart = namePart.replace(leadingTherapyRegex, "").trim();
        }

        const patientName = namePart.length > 3 ? namePart.split(/\s{2,}|,/)[0].trim() : null;

        rows.push({
          patient_full_name: patientName,
          patient_birth_date: dates[0] ? parseBrDate(dates[0]) : null,
          patient_cpf: cpfMatch ? normalizeCpf(cpfMatch[0]) : null,
          patient_sexo: /feminino|\bF\b/i.test(line) ? "F" : /masculino|\bM\b/i.test(line) ? "M" : null,
          patient_cid: line.match(/\b[Ff]\d{2}\.?\d?\b/)?.[0] || null,
          guardian_full_name: null,
          guardian_cpf: null,
          guardian_relationship: null,
          guardian_email: null,
          guardian_phones: phones,
          card_number: cardMatch ? cardMatch[0].replace(/\D/g, "") : null,
          plan_name: "Unimed",
          card_valid_until: dates[1] ? parseBrDate(dates[1]) : null,
          guide_number: line.match(/\b\d{8,10}\b/)?.[0] || null,
          procedure_code:
            detectedTherapy ??
            line.match(/fono|psico|ocupacional|terapia|aba|fisioterapia/gi)?.join(", ") ??
            null,
          sessions_authorized: Number(line.match(/\b\d{1,2}\s*(sess[õo]es|hs|horas)\b/i)?.[0]?.replace(/\D/g, "")) || null,
          valid_from: dates[0] ? parseBrDate(dates[0]) : null,
          valid_to: dates[1] ? parseBrDate(dates[1]) : null,
          authorization_password: null,
          extra: { source: "native_regex" },
          confidence: {
            patient_full_name: patientName ? 0.95 : 0.5,
            card_number: cardMatch ? 0.99 : 0.5,
          },
          warnings: [],
        });
      }
    }

    if (rows.length > 0) {
      return {
        detected_insurer_name: detectedInsurer,
        rows,
        warnings: ["Dados extraídos via Parser Nativo de Alta Velocidade (Regex)."],
        truncated: false,
      };
    }
  } catch (e) {
    console.warn("[Native PDF Regex extraction fallback to Gemini]:", e);
  }
  return null;
}

/**
 * Tenta extração nativa Regex em milissegundos. Se o PDF for imagem ou não estruturado,
 * chama o Gemini com o PDF do lote numa requisição multimodal.
 */
export async function extractIntakeRowsFromPdf(
  file: IntakeFileInput,
  insurerNames: string[],
  opts?: { profile?: IntakeExtractionProfile; timeoutMs?: number },
): Promise<IntakeExtractionOutcome> {
  // 1ª Tentativa: Parser Nativo com Regex (Super Rápido, 0ms latency, sem custo de API)
  const nativeResult = await tryNativePdfRegexExtraction(file.base64, insurerNames);
  if (nativeResult && nativeResult.rows.length > 0) {
    return { success: true, result: nativeResult, model: "native-regex" };
  }

  // 2ª Tentativa: Chamada IA Gemini (Fallback para PDFs escaneados / imagens)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !isGeminiConfigured()) {
    return { success: false, error: "GEMINI_API_KEY não configurada." };
  }

  const prompt = buildIntakePrompt(insurerNames, opts?.profile);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType: file.mimeType, data: file.base64 } }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
  };

  try {
    const url = `${GEMINI_BASE_URL}?key=${apiKey.trim()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 90_000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[Insurance Intake Extraction Gemini Error ${res.status}]:`, errorText);
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

    return { success: true, result: coerceIntakeExtraction(parsed), model: "gemini" };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[Insurance Intake Extraction Exception]:", errMessage);
    return { success: false, error: errMessage };
  }
}

/**
 * Normaliza uma linha bruta (datas, CPF, telefone, convênio) — mesmos
 * normalizadores de lib/document-extraction.ts, aplicados campo a campo.
 * Telefone: escolhe o primeiro celular (11 dígitos, começa com 9 após o
 * DDD); se só houver número sem DDD e o perfil tiver `default_ddd`, prefixa
 * antes de normalizar; senão devolve null com aviso — bloquear a aprovação
 * até o supervisor corrigir é melhor que iniciar contato com número errado.
 */
export function normalizeIntakeRow(
  row: IntakeRow,
  insurers: { id: string; name: string }[],
  profile?: IntakeExtractionProfile,
): IntakeRow & { insurer_id: string | null; insurer_match_score: number | null; phone_e164: string | null } {
  const warnings = [...row.warnings];

  const normalizedCpf = normalizeCpf(row.patient_cpf);
  if (row.patient_cpf && !normalizedCpf) {
    warnings.push("CPF do paciente com formato ou dígito verificador inválido — confira manualmente.");
  }

  let phoneE164: string | null = null;
  for (const raw of row.guardian_phones) {
    const digits = raw.replace(/\D/g, "");
    const candidate = digits.length <= 9 && profile?.default_ddd ? `${profile.default_ddd}${digits}` : digits;
    const normalized = normalizePhone(candidate);
    if (normalized) {
      phoneE164 = normalized;
      break;
    }
  }
  if (row.guardian_phones.length > 0 && !phoneE164) {
    warnings.push("Nenhum telefone da linha pôde ser normalizado (sem DDD?) — preencha manualmente.");
  }

  const match = matchInsurer(row.plan_name, insurers);

  return {
    ...row,
    patient_cpf: normalizedCpf,
    patient_birth_date: parseBrDate(row.patient_birth_date),
    guardian_cpf: normalizeCpf(row.guardian_cpf),
    card_valid_until: parseBrDate(row.card_valid_until),
    valid_from: parseBrDate(row.valid_from),
    valid_to: parseBrDate(row.valid_to),
    warnings,
    phone_e164: phoneE164,
    insurer_id: match?.insurerId ?? null,
    insurer_match_score: match?.score ?? null,
  };
}
