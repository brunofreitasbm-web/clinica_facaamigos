"use client";

/**
 * Compressão client-side de uploads (PRD §4) antes do FormData: imagem vira
 * WebP redimensionado, PDF tem só as imagens embutidas recomprimidas
 * (lib/compress-pdf.ts). Sem dependência pesada no bundle inicial — o
 * pdf-lib só é carregado (import dinâmico) quando há PDF.
 *
 * Só uploads novos: nada aqui reprocessa arquivo já gravado.
 */
import { sniffFileType } from "./whatsapp-lead-pure.ts";
import { sanitizeFileName } from "./file-name.ts";
import { compressPdf } from "./compress-pdf.ts";

export type ImagePreset = "documento" | "foto" | "avatar";

export const IMAGE_PRESETS: Record<ImagePreset, { maxSide: number; quality: number }> = {
  /** Texto pequeno precisa continuar legível (laudo, guia, atestado). */
  documento: { maxSide: 2200, quality: 0.85 },
  foto: { maxSide: 1600, quality: 0.82 },
  avatar: { maxSide: 512, quality: 0.82 },
};

/** Lado maior final: nunca amplia (sem upscale). */
export function targetSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Superfície desenhada já orientada (EXIF) e redimensionada; `encode` gera o Blob final. */
export type RenderedImage = {
  width: number;
  height: number;
  encode: (mime: "image/webp" | "image/jpeg", quality: number) => Promise<Blob | null>;
};

/** Backend de render — o do navegador usa createImageBitmap + canvas; os testes injetam outro. */
export type ImageBackend = (file: Blob, maxSide: number, opaque: boolean) => Promise<RenderedImage | null>;

export const browserImageBackend: ImageBackend = async (file, maxSide, opaque) => {
  let bitmap: ImageBitmap;
  try {
    // 'from-image' aplica a orientação EXIF (foto de celular não sai deitada).
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const { width, height } = targetSize(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  // WebP preserva alpha; só o fallback JPEG (sem alpha) precisa de fundo branco.
  if (opaque) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return {
    width,
    height,
    encode: (mime, quality) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality)),
  };
};

export type CompressedImage = { blob: Blob; mime: "image/webp" | "image/jpeg" | string; ext: "webp" | "jpg" | string };

/**
 * Converte JPEG/PNG/WebP em WebP redimensionado. Devolve null quando não
 * há o que fazer (decodificação falhou). Se o navegador não gera WebP
 * (blob.type diferente), cai para JPEG. Se o resultado ficar maior que um
 * original JPEG/WebP, devolve o próprio original.
 */
export async function compressImage(
  file: Blob,
  preset: ImagePreset,
  backend: ImageBackend = browserImageBackend,
): Promise<CompressedImage | null> {
  const sniffed = sniffFileType(new Uint8Array(await file.slice(0, 1100).arrayBuffer()));
  if (!sniffed) return null;
  const { maxSide, quality } = IMAGE_PRESETS[preset];

  const rendered = await backend(file, maxSide, false);
  if (!rendered) return null;

  let blob = await rendered.encode("image/webp", quality);
  let mime: string = "image/webp";
  let ext = "webp";
  if (!blob || blob.type !== "image/webp") {
    // Safari antigo / navegador sem encoder WebP em canvas.
    const opaque = await backend(file, maxSide, true);
    blob = opaque ? await opaque.encode("image/jpeg", quality) : null;
    mime = "image/jpeg";
    ext = "jpg";
  }
  if (!blob || blob.size === 0) return null;

  if (blob.size >= file.size && (sniffed.mime === "image/webp" || sniffed.mime === "image/jpeg")) {
    return { blob: file, mime: sniffed.mime, ext: sniffed.ext };
  }
  return { blob, mime, ext };
}

type PrepareDeps = {
  imageBackend?: ImageBackend;
  pdf?: typeof compressPdf;
};

/**
 * Ponto de entrada único dos formulários. Roteia pelo tipo REAL (magic
 * bytes, não `file.type`): JPEG/PNG/WebP -> WebP; PDF -> recompressão das
 * imagens embutidas; GIF, HEIC/HEIF, vídeo e o resto passam intactos. O nome
 * devolvido já leva a extensão correta. Nunca lança: em qualquer falha
 * devolve o arquivo original.
 */
export async function prepareUpload(file: File, preset: ImagePreset, deps: PrepareDeps = {}): Promise<File> {
  try {
    const sniffed = sniffFileType(new Uint8Array(await file.slice(0, 1100).arrayBuffer()));
    if (!sniffed) return file;

    if (sniffed.mime === "application/pdf") {
      const result = await (deps.pdf ?? compressPdf)(new Uint8Array(await file.arrayBuffer()));
      if (!result.changed) return file;
      return new File([result.bytes as BlobPart], sanitizeFileName(file.name, { ext: "pdf" }), { type: "application/pdf" });
    }

    if (sniffed.mime === "image/jpeg" || sniffed.mime === "image/png" || sniffed.mime === "image/webp") {
      const out = await compressImage(file, preset, deps.imageBackend);
      if (!out) return file;
      if (out.blob === file) return file;
      return new File([out.blob], sanitizeFileName(file.name, { ext: out.ext }), { type: out.mime });
    }
  } catch {
    // Compressão é otimização: nunca bloqueia o envio.
  }
  return file;
}

/** Troca no FormData o arquivo do campo pelo já preparado (campos sem arquivo ficam como estão). */
export async function prepareFormDataFile(formData: FormData, field: string, preset: ImagePreset): Promise<void> {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) return;
  formData.set(field, await prepareUpload(value, preset));
}
