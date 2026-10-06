/**
 * Recompressão de PDF no cliente (PRD §4) — só as IMAGENS embutidas
 * (scan/foto) são reencodadas em JPEG, reduzidas para no máximo ~200 dpi
 * efetivos. Nada é rasterizado: o texto/fontes/camada OCR ficam como estão,
 * porque `unpdf` (extração de laudo/guia) precisa do texto do PDF.
 *
 * Regras de segurança:
 *  - PDF criptografado, assinado digitalmente (/ByteRange) ou que o pdf-lib
 *    não consegue carregar volta IDÊNTICO (reescrever invalidaria a
 *    assinatura / não temos a senha);
 *  - só devolve o PDF novo se ficar >= 15% menor; senão, o original.
 *
 * pdf-lib é carregado por `import()` dinâmico para não pesar o bundle
 * inicial. A decodificação/encode de pixels é injetável (`JpegRecoder`):
 * no navegador usa canvas; os testes injetam um recoder em Node.
 */

export const MIN_PDF_SAVING = 0.15;
/** Resolução efetiva máxima das imagens embutidas. */
export const MAX_PDF_DPI = 200;
const JPEG_QUALITY = 0.8;
/** Não vale a pena (nem a memória) mexer em imagem pequena. */
const MIN_IMAGE_STREAM_BYTES = 20 * 1024;
/** Acima disto o parse em memória no navegador fica caro demais: passa direto. */
const MAX_PDF_INPUT_BYTES = 40 * 1024 * 1024;
/** Uma imagem só é trocada se o JPEG novo for pelo menos 10% menor que o stream original. */
const MIN_IMAGE_SAVING = 0.1;

export type PixelSource =
  | { kind: "jpeg"; data: Uint8Array; width: number; height: number }
  | { kind: "raw"; data: Uint8Array; width: number; height: number; channels: 1 | 3 };

export type JpegRecoder = (
  src: PixelSource,
  opts: { maxSide: number; quality: number },
) => Promise<{ data: Uint8Array; width: number; height: number } | null>;

export type PdfCompressResult = { bytes: Uint8Array; changed: boolean; reason?: string };

export const browserJpegRecoder: JpegRecoder = async (src, { maxSide, quality }) => {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  if (src.kind === "jpeg") {
    let bitmap: ImageBitmap;
    try {
      // 'none': o PDF ignora a orientação EXIF do JPEG embutido; aplicá-la giraria a página.
      bitmap = await createImageBitmap(new Blob([src.data as BlobPart], { type: "image/jpeg" }), {
        imageOrientation: "none",
      });
    } catch {
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
  } else {
    const rgba = new Uint8ClampedArray(src.width * src.height * 4);
    for (let i = 0, p = 0; i < src.width * src.height; i++) {
      if (src.channels === 3) {
        rgba[p++] = src.data[i * 3];
        rgba[p++] = src.data[i * 3 + 1];
        rgba[p++] = src.data[i * 3 + 2];
      } else {
        const g = src.data[i];
        rgba[p++] = g;
        rgba[p++] = g;
        rgba[p++] = g;
      }
      rgba[p++] = 255;
    }
    const full = document.createElement("canvas");
    full.width = src.width;
    full.height = src.height;
    const fullCtx = full.getContext("2d");
    if (!fullCtx) return null;
    fullCtx.putImageData(new ImageData(rgba, src.width, src.height), 0, 0);
    ctx.drawImage(full, 0, 0, width, height);
  }

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", quality));
  if (!blob || blob.type !== "image/jpeg") return null;
  return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
};

const latin1 = new TextDecoder("latin1");

/** Assinado (/ByteRange) ou criptografado (/Encrypt): não reescrever. */
export function isSignedOrEncryptedPdf(bytes: Uint8Array): boolean {
  const text = latin1.decode(bytes);
  return /\/ByteRange\s*\[/.test(text) || /\/Encrypt\b/.test(text);
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Desfaz os filtros PNG (Predictor 10-15) de um stream Flate de 8 bits/componente. */
function unpredictPng(data: Uint8Array, columns: number, colors: number): Uint8Array | null {
  const rowBytes = columns * colors;
  const rows = data.length / (rowBytes + 1);
  if (!Number.isInteger(rows)) return null;
  const out = new Uint8Array(rows * rowBytes);
  for (let r = 0; r < rows; r++) {
    const filter = data[r * (rowBytes + 1)];
    const src = r * (rowBytes + 1) + 1;
    const dst = r * rowBytes;
    const prev = dst - rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const x = data[src + i];
      const a = i >= colors ? out[dst + i - colors] : 0;
      const b = r > 0 ? out[prev + i] : 0;
      const c = r > 0 && i >= colors ? out[prev + i - colors] : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: return null;
      }
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}

export async function compressPdf(
  input: Uint8Array,
  recoder: JpegRecoder = browserJpegRecoder,
): Promise<PdfCompressResult> {
  const original: PdfCompressResult = { bytes: input, changed: false };
  if (input.length > MAX_PDF_INPUT_BYTES) return { ...original, reason: "too-large" };
  if (isSignedOrEncryptedPdf(input)) return { ...original, reason: "signed-or-encrypted" };

  try {
    const { PDFDocument, PDFName, PDFNumber, PDFArray, PDFDict, PDFRawStream, PDFBool } = await import("pdf-lib");

    let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
    try {
      doc = await PDFDocument.load(input, { ignoreEncryption: false, updateMetadata: false, throwOnInvalidObject: true });
    } catch {
      return { ...original, reason: "load-failed" };
    }

    const context = doc.context;

    // Defesa em profundidade: a assinatura pode estar dentro de object stream
    // (invisível para o scan de bytes acima). Qualquer dict /Sig ou /ByteRange
    // = documento assinado.
    const sigKeys = [PDFName.of("Type"), PDFName.of("FT")];
    const sigName = PDFName.of("Sig");
    const byteRange = PDFName.of("ByteRange");
    for (const [, obj] of context.enumerateIndirectObjects()) {
      const d = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null;
      if (d && (d.has(byteRange) || sigKeys.some((k) => d.get(k) === sigName))) {
        return { ...original, reason: "signed-or-encrypted" };
      }
    }
    const longPageSide = Math.max(
      ...doc.getPages().map((p) => {
        const { width, height } = p.getSize();
        return Math.max(width, height);
      }),
      1,
    );
    // Assume a imagem ocupando a página inteira: só pode SUBestimar o dpi real
    // (imagem menor na página => dpi maior), então nunca reduz além do necessário.
    const maxSide = Math.round((MAX_PDF_DPI * longPageSide) / 72);

    const names = {
      subtype: PDFName.of("Subtype"),
      image: PDFName.of("Image"),
      filter: PDFName.of("Filter"),
      dct: PDFName.of("DCTDecode"),
      flate: PDFName.of("FlateDecode"),
      width: PDFName.of("Width"),
      height: PDFName.of("Height"),
      bpc: PDFName.of("BitsPerComponent"),
      cs: PDFName.of("ColorSpace"),
      rgb: PDFName.of("DeviceRGB"),
      gray: PDFName.of("DeviceGray"),
      icc: PDFName.of("ICCBased"),
      parms: PDFName.of("DecodeParms"),
      smask: PDFName.of("SMask"),
    };

    let replaced = 0;
    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;
      if (dict.lookup(names.subtype) !== names.image) continue;
      if (obj.getContentsSize() < MIN_IMAGE_STREAM_BYTES) continue;
      // Máscaras (stencil, color-key, /Mask) e /Decode customizado: não mexer.
      if (dict.has(PDFName.of("Mask")) || dict.has(PDFName.of("Decode"))) continue;
      if (dict.lookup(PDFName.of("ImageMask")) === PDFBool.True) continue;

      const width = dict.lookup(names.width);
      const height = dict.lookup(names.height);
      if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) continue;
      const w = width.asNumber();
      const h = height.asNumber();

      // Espaço de cor: só RGB/Gray (ou ICC de 1/3 canais). CMYK, Indexed, etc. ficam.
      let channels: 1 | 3 | null = null;
      let keepColorSpace = false;
      const cs = dict.lookup(names.cs);
      if (cs === names.rgb) channels = 3;
      else if (cs === names.gray) channels = 1;
      else if (cs instanceof PDFArray && cs.lookup(0) === names.icc) {
        const profile = cs.lookup(1);
        const n = profile instanceof PDFRawStream ? profile.dict.lookup(PDFName.of("N")) : undefined;
        if (n instanceof PDFNumber && (n.asNumber() === 3 || n.asNumber() === 1)) {
          channels = n.asNumber() as 1 | 3;
          keepColorSpace = channels === 3;
        }
      }
      if (!channels) continue;

      const filterRaw = dict.lookup(names.filter);
      const filters = filterRaw instanceof PDFArray ? filterRaw.asArray().map((f) => context.lookup(f)) : [filterRaw];
      if (filters.length !== 1) continue;

      let source: PixelSource | null = null;
      if (filters[0] === names.dct) {
        source = { kind: "jpeg", data: obj.getContents(), width: w, height: h };
      } else if (filters[0] === names.flate) {
        const bpc = dict.lookup(names.bpc);
        if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) continue;
        let parms = dict.lookup(names.parms);
        if (parms instanceof PDFArray) parms = parms.lookup(0);
        let predictor = 1;
        if (parms instanceof PDFDict) {
          const p = parms.lookup(PDFName.of("Predictor"));
          if (p instanceof PDFNumber) predictor = p.asNumber();
        }
        let pixels: Uint8Array | null;
        try {
          pixels = await inflate(obj.getContents());
        } catch {
          continue;
        }
        if (predictor >= 10) pixels = unpredictPng(pixels, w, channels);
        else if (predictor !== 1) continue;
        if (!pixels || pixels.length !== w * h * channels) continue;
        source = { kind: "raw", data: pixels, width: w, height: h, channels };
      }
      if (!source) continue;

      const out = await recoder(source, { maxSide, quality: JPEG_QUALITY });
      if (!out || out.data.length >= obj.getContentsSize() * (1 - MIN_IMAGE_SAVING)) continue;

      const newDict = context.obj({
        Type: "XObject",
        Subtype: "Image",
        Width: out.width,
        Height: out.height,
        BitsPerComponent: 8,
        Filter: "DCTDecode",
        Length: out.data.length,
      });
      newDict.set(names.cs, keepColorSpace ? dict.get(names.cs)! : names.rgb);
      const smask = dict.get(names.smask);
      if (smask) newDict.set(names.smask, smask);
      context.assign(ref, PDFRawStream.of(newDict, out.data));
      replaced++;
    }

    if (replaced === 0) return { ...original, reason: "no-gain" };

    const saved = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
    if (saved.length > input.length * (1 - MIN_PDF_SAVING)) return { ...original, reason: "below-threshold" };
    return { bytes: saved, changed: true };
  } catch {
    return { ...original, reason: "error" };
  }
}
