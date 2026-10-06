// lib/upload-bytes.ts
//
// Validação no servidor dos bytes de um upload: o `file.type` e o atributo
// `accept` do input vêm do cliente e não são confiáveis. O tipo, o
// content-type gravado e a extensão do path saem do conteúdo real
// (sniffFileType). Sem imports com alias `@/` (testável com node --test).
import { sniffFileType, type SniffedFileType } from "./whatsapp-lead-pure.ts";

export const DOCUMENT_UPLOAD_MIMES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const IMAGE_UPLOAD_MIMES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/** Tipo real do conteúdo quando está entre os permitidos; null caso contrário. */
export function sniffAllowed(bytes: Uint8Array, allowed: ReadonlySet<string>): SniffedFileType | null {
  const sniffed = sniffFileType(bytes);
  return sniffed && allowed.has(sniffed.mime) ? sniffed : null;
}
