// lib/media-optimize.ts
//
// Único caminho do sistema SEM navegador: mídia que chega pelo webhook do
// Twilio (WhatsApp). Todo o resto é comprimido no cliente antes do FormData
// (lib/compress-image.ts). Aqui o `sharp` converte JPEG/PNG/WebP em WebP;
// HEIC/HEIF e PDF ficam como estão (HEIC é guardado como veio; PDF não é
// rasterizado para o `unpdf` continuar enxergando o texto).
//
// Regra de ouro: nunca perder o arquivo. Qualquer falha ou estouro do
// orçamento de tempo do webhook devolve o original. Sem imports com alias
// `@/` (testável com `node --test`).
import { sniffFileType } from "./whatsapp-lead-pure.ts";

/** Mesmo lado máximo do preset `documento` do cliente. */
const MAX_SIDE = 2200;
const WEBP_QUALITY = 85;
/** Folga dentro dos ~15s do webhook (download do Twilio + resposta ao WhatsApp). */
const CONVERT_TIMEOUT_MS = 6000;

const CONVERTIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export type OptimizedMedia = { buffer: Buffer; mime: string };

async function convertToWebp(buffer: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(buffer, { failOn: "error" })
    .rotate() // aplica a orientação EXIF antes de descartar os metadados
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

export async function optimizeIncomingImage(
  buffer: Buffer,
  mime: string,
  timeoutMs: number = CONVERT_TIMEOUT_MS,
): Promise<OptimizedMedia> {
  const original: OptimizedMedia = { buffer, mime };
  // Decide pelos bytes reais, não pelo Content-Type informado pelo remetente.
  const sniffed = sniffFileType(buffer);
  if (!sniffed || !CONVERTIBLE.has(sniffed.mime)) return original;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const converted = await Promise.race([
      convertToWebp(buffer),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    if (converted.length === 0) return original;
    // Já era JPEG/WebP e a conversão não ajudou: mantém o original.
    if (converted.length >= buffer.length && (sniffed.mime === "image/jpeg" || sniffed.mime === "image/webp")) {
      return { buffer, mime: sniffed.mime };
    }
    return { buffer: converted, mime: "image/webp" };
  } catch (err) {
    console.error("[Media Optimize] Falha ao converter para WebP; gravando o original:", err instanceof Error ? err.message : err);
    return original;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
