// lib/document-extraction.ts
// "Cadastro assistido por IA": uma única chamada multimodal ao Gemini recebe
// todos os arquivos de um rascunho (registration_drafts) — fotos/PDF de
// certidão, RG/CPF, comprovante de residência, carteirinha, guia e laudo —
// e devolve os dados de cadastro já estruturados em JSON. Segue o mesmo
// padrão de lib/gemini.ts (inlineData + responseMimeType "application/json",
// temperature baixa, parse defensivo) e a mesma regra de "sem fallback
// fabricado": qualquer falha de rede/parse devolve { success: false, error }
// — nunca um resultado inventado. Quem valida de verdade os valores é
// sempre a recepção, na tela de revisão; os normalizadores abaixo só
// arrumam formato (datas, CPF, UF...) para facilitar a leitura humana.
import { GEMINI_BASE_URL, isGeminiConfigured } from "@/lib/gemini";
import { formatE164Phone } from "@/lib/twilio";

export type ExtractedDocType =
  | "certidao_nascimento"
  | "documento_identidade"
  | "comprovante_residencia"
  | "carteirinha"
  | "autorizacao"
  | "laudo"
  | "pedido_medico"
  | "outro";

export type DocumentExtraction = {
  patient: {
    full_name: string | null;
    birth_date: string | null; // ISO yyyy-mm-dd
    cpf: string | null;
    sexo: "F" | "M" | null;
    naturalidade: string | null;
    cid: string | null;
    complaint_hint: string | null;
  };
  guardian: {
    full_name: string | null;
    cpf: string | null;
    rg: string | null;
    phone: string | null;
    email: string | null;
    relationship: "mae" | "pai" | "avo" | "tutor" | "outro" | null;
  };
  address: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  };
  insurance: {
    insurer_name: string | null;
    insurer_id: string | null;
    insurer_match_score: number | null;
    card_number: string | null;
    plan_name: string | null;
    card_valid_until: string | null;
  };
  authorization: {
    guide_number: string | null;
    procedure_code: string | null;
    sessions_authorized: number | null;
    valid_from: string | null;
    valid_to: string | null;
    authorization_password: string | null;
    password_valid_until: string | null;
  };
  documents: { index: number; kind: ExtractedDocType; summary: string }[];
  confidence: Record<string, number>;
  warnings: string[];
};

export type ExtractionOutcome =
  | { success: true; result: DocumentExtraction; model: string }
  | { success: false; error: string };

export type ExtractionFileInput = { base64: string; mimeType: string; index: number };

const DOC_KINDS: ExtractedDocType[] = [
  "certidao_nascimento",
  "documento_identidade",
  "comprovante_residencia",
  "carteirinha",
  "autorizacao",
  "laudo",
  "pedido_medico",
  "outro",
];

function buildPrompt(fileCount: number, insurerNames: string[], guardianMessage?: string): string {
  return `Você recebe ${fileCount} arquivo(s) (índice 0 a ${fileCount - 1}) enviados por um responsável para o cadastro de uma criança numa clínica de desenvolvimento infantil (TEA/terapias). Podem ser: certidão de nascimento, RG/CPF, comprovante de residência, carteirinha de convênio, guia de autorização, laudo médico ou pedido médico.

${guardianMessage ? `O responsável também escreveu esta mensagem junto: "${guardianMessage}"\n` : ""}
Convênios já cadastrados nesta clínica (use para preencher "insurance.insurer_name" com o nome mais parecido, se achar um destes na carteirinha/guia): ${insurerNames.length > 0 ? insurerNames.join(", ") : "(nenhum cadastrado ainda)"}.

Extraia SOMENTE o que estiver legível. Use null quando não encontrar ou não tiver certeza — NUNCA invente um valor. Regras de formato:
- Datas sempre em "YYYY-MM-DD".
- CPF/CEP só dígitos (sem pontuação).
- "address.uf" com 2 letras maiúsculas (ex.: "SP").
- "patient.sexo" só "F" ou "M" (null se não achar).
- "guardian.relationship" um de: mae, pai, avo, tutor, outro.
- "authorization.sessions_authorized" um número inteiro, ou null.

Responda APENAS um JSON com exatamente este formato:
{
  "patient": {"full_name": string|null, "birth_date": string|null, "cpf": string|null, "sexo": "F"|"M"|null, "naturalidade": string|null, "cid": string|null, "complaint_hint": string|null},
  "guardian": {"full_name": string|null, "cpf": string|null, "rg": string|null, "phone": string|null, "email": string|null, "relationship": string|null},
  "address": {"cep": string|null, "logradouro": string|null, "numero": string|null, "complemento": string|null, "bairro": string|null, "cidade": string|null, "uf": string|null},
  "insurance": {"insurer_name": string|null, "card_number": string|null, "plan_name": string|null, "card_valid_until": string|null},
  "authorization": {"guide_number": string|null, "procedure_code": string|null, "sessions_authorized": number|null, "valid_from": string|null, "valid_to": string|null, "authorization_password": string|null, "password_valid_until": string|null},
  "documents": [{"index": number, "kind": "certidao_nascimento"|"documento_identidade"|"comprovante_residencia"|"carteirinha"|"autorizacao"|"laudo"|"pedido_medico"|"outro", "summary": string}],
  "confidence": {"patient.full_name": number, "...": number},
  "warnings": [string]
}
Preencha "confidence" (0 a 1) para cada campo não-nulo que você preencheu (chave = caminho, ex. "patient.full_name", "address.cep"). Em "warnings", liste inconsistências encontradas (ex.: nomes divergentes entre documentos, documento ilegível, carteirinha vencida). Responda só o JSON, sem texto adicional.`;
}

function coerceString(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function coerceNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function coerceKind(v: unknown): ExtractedDocType {
  return typeof v === "string" && (DOC_KINDS as string[]).includes(v) ? (v as ExtractedDocType) : "outro";
}

/**
 * Parse defensivo do JSON bruto devolvido pelo Gemini — nunca confia no
 * shape vindo da API, coerce campo a campo. Ver regra de "sem fallback
 * fabricado" no cabeçalho do arquivo: se o parse falhar por completo, quem
 * chama isso já tratou o erro antes de chegar aqui (extractRegistrationFromFiles
 * só invoca esta função depois de um JSON.parse bem-sucedido).
 */
function coerceExtraction(raw: unknown): DocumentExtraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  const patient = (r.patient ?? {}) as Record<string, unknown>;
  const guardian = (r.guardian ?? {}) as Record<string, unknown>;
  const address = (r.address ?? {}) as Record<string, unknown>;
  const insurance = (r.insurance ?? {}) as Record<string, unknown>;
  const authorization = (r.authorization ?? {}) as Record<string, unknown>;
  const documentsRaw = Array.isArray(r.documents) ? r.documents : [];
  const confidenceRaw = (r.confidence ?? {}) as Record<string, unknown>;
  const warningsRaw = Array.isArray(r.warnings) ? r.warnings : [];

  const sexoRaw = coerceString(patient.sexo);
  const relRaw = coerceString(guardian.relationship);

  return {
    patient: {
      full_name: coerceString(patient.full_name),
      birth_date: coerceString(patient.birth_date),
      cpf: coerceString(patient.cpf),
      sexo: sexoRaw === "F" || sexoRaw === "M" ? sexoRaw : null,
      naturalidade: coerceString(patient.naturalidade),
      cid: coerceString(patient.cid),
      complaint_hint: coerceString(patient.complaint_hint),
    },
    guardian: {
      full_name: coerceString(guardian.full_name),
      cpf: coerceString(guardian.cpf),
      rg: coerceString(guardian.rg),
      phone: coerceString(guardian.phone),
      email: coerceString(guardian.email),
      relationship: (["mae", "pai", "avo", "tutor", "outro"].includes(relRaw ?? "")
        ? relRaw
        : null) as DocumentExtraction["guardian"]["relationship"],
    },
    address: {
      cep: coerceString(address.cep),
      logradouro: coerceString(address.logradouro),
      numero: coerceString(address.numero),
      complemento: coerceString(address.complemento),
      bairro: coerceString(address.bairro),
      cidade: coerceString(address.cidade),
      uf: coerceString(address.uf),
    },
    insurance: {
      insurer_name: coerceString(insurance.insurer_name),
      insurer_id: null,
      insurer_match_score: null,
      card_number: coerceString(insurance.card_number),
      plan_name: coerceString(insurance.plan_name),
      card_valid_until: coerceString(insurance.card_valid_until),
    },
    authorization: {
      guide_number: coerceString(authorization.guide_number),
      procedure_code: coerceString(authorization.procedure_code),
      sessions_authorized: coerceNumber(authorization.sessions_authorized),
      valid_from: coerceString(authorization.valid_from),
      valid_to: coerceString(authorization.valid_to),
      authorization_password: coerceString(authorization.authorization_password),
      password_valid_until: coerceString(authorization.password_valid_until),
    },
    documents: documentsRaw.map((d, i) => {
      const doc = (d ?? {}) as Record<string, unknown>;
      return {
        index: coerceNumber(doc.index) ?? i,
        kind: coerceKind(doc.kind),
        summary: coerceString(doc.summary) ?? "",
      };
    }),
    confidence: Object.fromEntries(
      Object.entries(confidenceRaw)
        .map(([k, v]) => [k, coerceNumber(v)])
        .filter((e): e is [string, number] => e[1] !== null),
    ),
    warnings: warningsRaw.filter((w): w is string => typeof w === "string"),
  };
}

/**
 * Chama o Gemini com todos os arquivos do rascunho numa única requisição
 * multimodal. Nunca lança — toda falha (chave ausente, HTTP != 200, JSON
 * inválido/vazio) volta como `{ success: false, error }`.
 */
export async function extractRegistrationFromFiles(
  files: ExtractionFileInput[],
  insurerNames: string[],
  opts?: { guardianMessage?: string; timeoutMs?: number },
): Promise<ExtractionOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !isGeminiConfigured()) {
    return { success: false, error: "GEMINI_API_KEY não configurada." };
  }
  if (files.length === 0) {
    return { success: false, error: "Nenhum arquivo para extrair." };
  }

  const prompt = buildPrompt(files.length, insurerNames, opts?.guardianMessage);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.base64 } })),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
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
      console.error(`[Document Extraction Gemini Error ${res.status}]:`, errorText);
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
    console.error("[Document Extraction Exception]:", errMessage);
    return { success: false, error: errMessage };
  }
}

// ---------------------------------------------------------------------
// Normalizadores — puros, reusados tanto no processamento do rascunho
// quanto na validação server-side (nunca confiar em valor vindo do form).
// ---------------------------------------------------------------------

/** 11 dígitos + verificação dos 2 dígitos verificadores; null se inválido. */
export function normalizeCpf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null;

  const calcCheckDigit = (base: string, factor: number) => {
    let total = 0;
    for (const c of base) {
      total += Number(c) * factor--;
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheckDigit(digits.slice(0, 9), 10);
  const d2 = calcCheckDigit(digits.slice(0, 10), 11);
  if (d1 !== Number(digits[9]) || d2 !== Number(digits[10])) return null;
  return digits;
}

const MONTHS_PT: Record<string, string> = {
  janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04",
  maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09",
  outubro: "10", novembro: "11", dezembro: "12",
};

/** Aceita dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, "12 de março de 2019". Devolve ISO ou null. */
export function parseBrDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return isValidIsoDate(m[1], m[2], m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    return isValidIsoDate(m[3], month, day) ? `${m[3]}-${month}-${day}` : null;
  }

  m = s.match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})$/);
  if (m) {
    const month = MONTHS_PT[m[2]];
    const day = m[1].padStart(2, "0");
    if (!month) return null;
    return isValidIsoDate(m[3], month, day) ? `${m[3]}-${month}-${day}` : null;
  }

  return null;
}

function isValidIsoDate(yearStr: string, monthStr: string, dayStr: string): boolean {
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const BR_UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function normalizeUf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const uf = raw.trim().toUpperCase();
  return BR_UFS.has(uf) ? uf : null;
}

export function normalizeCep(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const formatted = formatE164Phone(raw);
  return formatted || null;
}

function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(plano|saude|convenio|de|do|da|s\.?a\.?|ltda)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      set.set(bg, (set.get(bg) ?? 0) + 1);
    }
    return set;
  };
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  let intersection = 0;
  for (const [bg, count] of bgA) {
    const countB = bgB.get(bg) ?? 0;
    intersection += Math.min(count, countB);
  }
  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

/** Casa o nome de convênio extraído com um `insurers.name` já cadastrado. */
export function matchInsurer(
  name: string | null,
  insurers: { id: string; name: string }[],
): { insurerId: string; score: number } | null {
  if (!name || insurers.length === 0) return null;
  const normalizedTarget = stripAccents(name);
  if (!normalizedTarget) return null;

  let best: { insurerId: string; score: number } | null = null;
  for (const insurer of insurers) {
    const normalizedCandidate = stripAccents(insurer.name);
    let score: number;
    if (normalizedCandidate === normalizedTarget) {
      score = 1;
    } else if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) {
      score = 0.8;
    } else {
      score = diceCoefficient(normalizedTarget, normalizedCandidate);
    }
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { insurerId: insurer.id, score };
    }
  }
  return best;
}

/** Aplica os normalizadores acima sobre o resultado bruto do Gemini. */
export function applyNormalization(
  result: DocumentExtraction,
  insurers: { id: string; name: string }[],
): DocumentExtraction {
  const normalizedCpf = normalizeCpf(result.patient.cpf);
  const warnings = [...result.warnings];
  if (result.patient.cpf && !normalizedCpf) {
    warnings.push("CPF do paciente com formato ou dígito verificador inválido — confira manualmente.");
  }

  const match = matchInsurer(result.insurance.insurer_name, insurers);
  if (result.insurance.insurer_name && !match) {
    warnings.push(`Convênio "${result.insurance.insurer_name}" não encontrado no cadastro — selecione manualmente.`);
  }

  return {
    ...result,
    patient: {
      ...result.patient,
      cpf: normalizedCpf,
      birth_date: parseBrDate(result.patient.birth_date),
    },
    guardian: {
      ...result.guardian,
      cpf: normalizeCpf(result.guardian.cpf),
      phone: normalizePhone(result.guardian.phone),
    },
    address: {
      ...result.address,
      cep: normalizeCep(result.address.cep),
      uf: normalizeUf(result.address.uf),
    },
    insurance: {
      ...result.insurance,
      insurer_id: match?.insurerId ?? null,
      insurer_match_score: match?.score ?? null,
      card_valid_until: parseBrDate(result.insurance.card_valid_until),
    },
    authorization: {
      ...result.authorization,
      valid_from: parseBrDate(result.authorization.valid_from),
      valid_to: parseBrDate(result.authorization.valid_to),
      password_valid_until: parseBrDate(result.authorization.password_valid_until),
    },
    warnings,
  };
}

/** Chaves de `confidence` abaixo do limiar — usado pela UI para destacar campos. */
export function lowConfidenceKeys(result: DocumentExtraction, threshold = 0.7): string[] {
  return Object.entries(result.confidence)
    .filter(([, score]) => score < threshold)
    .map(([key]) => key);
}
