// lib/whatsapp-lead-pure.ts
// Funções PURAS do "cadastro automático de lead a partir de documentos
// enviados por WhatsApp" (lib/whatsapp-lead.ts). Ficam num arquivo à parte,
// sem nenhum import com alias `@/`, para que `node --test
// --experimental-strip-types` (tests/whatsapp-lead-pure.test.ts) consiga
// importá-las sem passar pelo bundler do Next.

// ---------------------------------------------------------------------
// Tipo real do arquivo (magic bytes)
// ---------------------------------------------------------------------

export type SniffedFileType = { mime: string; ext: string };

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function asciiAt(buf: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = offset; i < Math.min(buf.length, offset + length); i++) out += String.fromCharCode(buf[i]);
  return out;
}

/**
 * Descobre o tipo REAL do conteúdo pelos magic bytes. O `Content-Type` que o
 * Twilio (ou o remetente) informa não é confiável — já houve JPEG rotulado
 * como PDF que foi salvo como `.pdf` e nunca abriu. Devolve null quando o
 * conteúdo não é nenhum dos formatos conhecidos.
 */
export function sniffFileType(buf: Uint8Array): SniffedFileType | null {
  if (!buf || buf.length < 4) return null;

  // "%PDF" — a spec tolera lixo nos primeiros 1024 bytes antes do cabeçalho.
  const head = asciiAt(buf, 0, 1024);
  if (head.includes("%PDF-")) return { mime: "application/pdf", ext: "pdf" };

  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (asciiAt(buf, 0, 4) === "RIFF" && asciiAt(buf, 8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  const gif = asciiAt(buf, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return { mime: "image/gif", ext: "gif" };

  // HEIC/HEIF: caixa ISO-BMFF "ftyp" no offset 4, marca ("brand") no offset 8.
  if (asciiAt(buf, 4, 4) === "ftyp") {
    const brand = asciiAt(buf, 8, 4).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"].includes(brand)) {
      return { mime: "image/heic", ext: "heic" };
    }
    if (brand === "mif1" || brand === "msf1") return { mime: "image/heif", ext: "heif" };
  }

  return null;
}

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function mimeFromExtension(ext: string): string | null {
  return EXT_TO_MIME[ext.replace(/^\./, "").toLowerCase()] ?? null;
}

/** Troca (ou acrescenta) a extensão do nome pela do tipo real do conteúdo. */
export function ensureExtension(name: string, ext: string): string {
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${base || "arquivo"}.${ext}`;
}

// ---------------------------------------------------------------------
// Categoria / caminho de storage
// ---------------------------------------------------------------------

export type LeadDocKind =
  | "laudo"
  | "guia"
  | "carteirinha"
  | "pedido_medico"
  | "certidao_nascimento"
  | "documento_identidade"
  | "comprovante_residencia"
  | "outro";

const LEAD_DOC_KINDS: LeadDocKind[] = [
  "laudo",
  "guia",
  "carteirinha",
  "pedido_medico",
  "certidao_nascimento",
  "documento_identidade",
  "comprovante_residencia",
  "outro",
];

/** `documents.category` correspondente (a guia vira `autorizacao`). */
export function kindToCategory(kind: LeadDocKind): string {
  switch (kind) {
    case "guia":
      return "autorizacao";
    case "laudo":
    case "carteirinha":
    case "pedido_medico":
    case "certidao_nascimento":
    case "documento_identidade":
    case "comprovante_residencia":
      return kind;
    default:
      return "outro";
  }
}

/**
 * Converte um rótulo vindo de fora (`detected_type` do rascunho, `kind` da
 * extração do Gemini — onde a guia se chama `autorizacao`) num LeadDocKind.
 * Rótulo desconhecido vira "outro".
 */
export function coerceLeadKind(raw: string | null | undefined): LeadDocKind {
  if (!raw) return "outro";
  if (raw === "autorizacao") return "guia";
  return (LEAD_DOC_KINDS as string[]).includes(raw) ? (raw as LeadDocKind) : "outro";
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * `leads/<só-dígitos-do-telefone>/<epochms>-<kind>-<rand>.<ext>`.
 * - `pending: true` → `leads/pending/<telefone>/…` (arquivo recebido antes de
 *   o lead ter nome+nascimento).
 * - `stableKey` troca `<epochms>-…-<rand>` por uma chave determinística, para
 *   que a reentrega do mesmo webhook caia no mesmo objeto (upsert:false) em
 *   vez de gerar outro arquivo.
 */
export function buildLeadStoragePath(params: {
  phone: string;
  kind: LeadDocKind;
  ext: string;
  now?: Date;
  rand?: string;
  pending?: boolean;
  stableKey?: string;
}): string {
  const digits = phoneDigits(params.phone) || "sem-telefone";
  const folder = params.pending ? `leads/pending/${digits}` : `leads/${digits}`;
  const ext = params.ext.replace(/^\./, "").toLowerCase();
  if (params.stableKey) return `${folder}/${params.stableKey}-${params.kind}.${ext}`;
  const epoch = (params.now ?? new Date()).getTime();
  const rand = params.rand ?? Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `${folder}/${epoch}-${params.kind}-${rand}.${ext}`;
}

// ---------------------------------------------------------------------
// Identidade do lead
// ---------------------------------------------------------------------

/** Nome do responsável quando ainda não sabemos — `guardians.full_name` é NOT NULL. */
export const GUARDIAN_PLACEHOLDER_NAME = "Responsável (contato WhatsApp)";

export function isPlaceholderGuardianName(name: string | null | undefined): boolean {
  return !name || !name.trim() || name.trim() === GUARDIAN_PLACEHOLDER_NAME;
}

/** Nome completo plausível: pelo menos 2 palavras com letras. Devolve o nome com espaços normalizados, ou null. */
export function normalizeFullName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 120) return null;
  const words = name.split(" ").filter((w) => /\p{L}/u.test(w));
  if (words.length < 2) return null;
  if (/[0-9@]/.test(name)) return null;
  return name;
}

function todayInClinicTz(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Aceita yyyy-mm-dd ou dd/mm/yyyy (também "-" e "."). Devolve ISO válido, >= 1900 e não futuro; senão null. */
export function normalizeBirthDate(raw: string | null | undefined, now: Date = new Date()): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let y: string;
  let m: string;
  let d: string;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [, y, m, d] = match;
  } else {
    match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!match) return null;
    [, d, m, y] = match;
  }
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 1900) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (iso > todayInClinicTz(now)) return null;
  return iso;
}

/** Só dígitos; exige 11 e recusa sequência repetida (000.000.000-00). Não confere dígito verificador. */
export function normalizeCpfDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null;
  return digits;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Só cria paciente-lead quando nome (2+ palavras) e nascimento válido são conhecidos. */
export function isLeadIdentityComplete(identity: {
  childName?: string | null;
  childBirthDate?: string | null;
}): boolean {
  return normalizeFullName(identity.childName) !== null && normalizeBirthDate(identity.childBirthDate) !== null;
}

function firstNameToken(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .split(/\s+/)[0] ?? "";
}

export type LeadCandidate = {
  patientId: string;
  fullName: string;
  birthDate: string;
  status: string;
  createdAt: string;
};

/**
 * Entre os pacientes ligados ao mesmo telefone (irmãos compartilham o número
 * do responsável), escolhe o que corresponde à criança citada. Sem
 * correspondência devolve null — quem chama cria um lead novo (se a
 * identidade estiver completa) ou guarda o arquivo como pendente.
 */
export function pickLeadCandidate(
  candidates: LeadCandidate[],
  identity: { childName?: string | null; childBirthDate?: string | null },
): LeadCandidate | null {
  if (candidates.length === 0) return null;
  const birth = normalizeBirthDate(identity.childBirthDate);
  const name = normalizeFullName(identity.childName);
  const byOldest = [...candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.patientId.localeCompare(b.patientId));
  const byNewest = [...byOldest].reverse();

  if (birth) {
    const sameBirth = byOldest.filter((c) => c.birthDate === birth);
    if (sameBirth.length === 0) return null;
    if (name) {
      const sameName = sameBirth.find((c) => firstNameToken(c.fullName) === firstNameToken(name));
      if (sameName) return sameName;
    }
    return sameBirth[0];
  }

  if (name) {
    return byOldest.find((c) => firstNameToken(c.fullName) === firstNameToken(name)) ?? null;
  }

  // Sem nome nem nascimento: o lead mais recente ainda em "interessado", senão o mais recente.
  return byNewest.find((c) => c.status === "interessado") ?? byNewest[0];
}
