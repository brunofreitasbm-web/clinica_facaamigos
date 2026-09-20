// lib/file-access.ts
//
// Lógica pura (sem I/O, sem imports com alias) por trás de /api/arquivos/*:
// interpretar o valor gravado nas colunas *_url da anamnese, mapear slot →
// coluna e descobrir o tipo real de um arquivo pelos primeiros bytes. Fica
// separada do route handler para poder ser testada com `node --test`
// (tests/file-access.test.ts).

export const CLINIC_DOCUMENTS_BUCKET = "clinic-documents";
export const LEGACY_PUBLIC_BUCKET = "patient-documents";

/** Teto (bytes) para o handler servir o arquivo ele mesmo, corrigindo o Content-Type. Acima disso, redireciona. */
export const MAX_INLINE_BYTES = 4 * 1024 * 1024;

export const ANAMNESIS_SLOT_COLUMN = {
  laudo: "laudo_pdf_url",
  guia: "guia_pdf_url",
  carteirinha_frente: "carteirinha_frente_url",
  carteirinha_verso: "carteirinha_verso_url",
} as const;

export type AnamnesisSlot = keyof typeof ANAMNESIS_SLOT_COLUMN;
export type AnamnesisColumn = (typeof ANAMNESIS_SLOT_COLUMN)[AnamnesisSlot];

export function isAnamnesisSlot(value: string): value is AnamnesisSlot {
  return Object.prototype.hasOwnProperty.call(ANAMNESIS_SLOT_COLUMN, value);
}

export type StoredFileRef =
  /** Padrão novo: `storage://clinic-documents/<path>` — bucket privado, vira URL assinada. */
  | { kind: "private"; bucket: string; path: string }
  /** Legado: URL pública do bucket `patient-documents` — o path é lido pelo admin (mesmo com o bucket privado). */
  | { kind: "legacy"; bucket: string; path: string }
  /** Qualquer outra coisa (ex.: URL crua do Twilio, que exige autenticação) — não dá para abrir daqui. */
  | { kind: "unsupported" };

const UNSUPPORTED: StoredFileRef = { kind: "unsupported" };

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Rejeita path vazio, absoluto ou com `..` — o path só é usado contra o nosso próprio bucket, mas não custa fechar a porta. */
function cleanStoragePath(raw: string): string | null {
  const parts = raw.split("/");
  const decoded: string[] = [];
  for (const part of parts) {
    const value = safeDecode(part);
    if (value === null) return null;
    if (value === "" || value === "." || value === "..") return null;
    decoded.push(value);
  }
  return decoded.length > 0 ? decoded.join("/") : null;
}

/**
 * Interpreta o valor de `laudo_pdf_url` / `guia_pdf_url` /
 * `carteirinha_*_url` (e afins).
 */
export function parseStoredFileRef(value: string | null | undefined): StoredFileRef {
  if (!value) return UNSUPPORTED;
  const trimmed = value.trim();

  const privateMatch = /^storage:\/\/([^/]+)\/(.+)$/.exec(trimmed);
  if (privateMatch) {
    if (privateMatch[1] !== CLINIC_DOCUMENTS_BUCKET) return UNSUPPORTED;
    const path = cleanStoragePath(privateMatch[2].split(/[?#]/)[0]);
    return path ? { kind: "private", bucket: CLINIC_DOCUMENTS_BUCKET, path } : UNSUPPORTED;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return UNSUPPORTED;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return UNSUPPORTED;

  const legacyMatch = new RegExp(
    `^/storage/v1/object/(?:public|authenticated)/${LEGACY_PUBLIC_BUCKET}/(.+)$`,
  ).exec(url.pathname);
  if (!legacyMatch) return UNSUPPORTED;
  const path = cleanStoragePath(legacyMatch[1]);
  return path ? { kind: "legacy", bucket: LEGACY_PUBLIC_BUCKET, path } : UNSUPPORTED;
}

export type DetectedFileType = { mime: string; ext: string };

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

/**
 * Tipo real do arquivo pelos primeiros bytes (magic bytes) — alguns objetos
 * legados são JPEG gravados com Content-Type application/pdf e o navegador
 * não abre. Devolve null quando não reconhece.
 */
export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  // PDF: o cabeçalho "%PDF-" pode vir depois de alguns bytes de lixo (a spec tolera até 1024).
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i < head.length; i++) {
    if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d], i)) return { mime: "application/pdf", ext: "pdf" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { mime: "image/gif", ext: "gif" };
  return null;
}

/**
 * Nome de arquivo seguro (ASCII) para `Content-Disposition`, a partir do
 * último segmento do path e com a extensão trocada pela do tipo real.
 */
export function downloadFileName(path: string, ext: string | null): string {
  const base = path.split("/").pop() || "arquivo";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "arquivo";
  if (!ext) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  return `${stem}.${ext}`;
}
