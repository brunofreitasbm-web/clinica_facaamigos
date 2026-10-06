// tests/compress-upload.test.ts
//
// Módulos de compressão de upload (lib/compress-image.ts, lib/compress-pdf.ts)
// e helpers de servidor (lib/file-name.ts, lib/upload-bytes.ts). O canvas do
// navegador é trocado por `sharp` via injeção de dependência — o que se testa
// é a lógica (roteamento, limites, fallback, regras de segurança do PDF).
import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFHexString, PDFName } from "pdf-lib";
import sharp from "sharp";
import {
  compressImage,
  prepareUpload,
  targetSize,
  type ImageBackend,
} from "../lib/compress-image.ts";
import { compressPdf, isSignedOrEncryptedPdf, type JpegRecoder } from "../lib/compress-pdf.ts";
import { sanitizeFileName } from "../lib/file-name.ts";
import { optimizeIncomingImage } from "../lib/media-optimize.ts";
import { DOCUMENT_UPLOAD_MIMES, sniffAllowed } from "../lib/upload-bytes.ts";

// --- Backends de teste (sharp no lugar de canvas) -------------------------

const sharpBackend: ImageBackend = async (file, maxSide, opaque) => {
  const buf = Buffer.from(await file.arrayBuffer());
  let pipeline = sharp(buf).rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
  if (opaque) pipeline = pipeline.flatten({ background: "#fff" });
  const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    encode: async (mime, quality) => {
      const img = sharp(data);
      const out = mime === "image/webp" ? await img.webp({ quality: Math.round(quality * 100) }).toBuffer() : await img.jpeg({ quality: Math.round(quality * 100) }).toBuffer();
      return new Blob([new Uint8Array(out)], { type: mime });
    },
  };
};

const sharpRecoder: JpegRecoder = async (src, { maxSide, quality }) => {
  const input =
    src.kind === "jpeg"
      ? sharp(Buffer.from(src.data))
      : sharp(Buffer.from(src.data), { raw: { width: src.width, height: src.height, channels: src.channels } });
  const { data, info } = await input
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: Math.round(quality * 100) })
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

function noise(width: number, height: number, channels: 3 | 4 = 3): Buffer {
  const buf = Buffer.alloc(width * height * channels);
  let seed = 12345;
  for (let i = 0; i < buf.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    // gradiente + ruído: comprime, mas não vira nada trivial
    buf[i] = ((i / channels) % width) / 8 + (seed >> 16) % 48;
  }
  return buf;
}

async function bigJpeg(width: number, height: number, quality = 98): Promise<Buffer> {
  return sharp(noise(width, height), { raw: { width, height, channels: 3 } }).jpeg({ quality }).toBuffer();
}

async function pdfWithJpeg(width = 2480, height = 3508): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const img = await doc.embedJpg(await bigJpeg(width, height));
  page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  page.drawText("Texto do laudo precisa continuar extraivel", { x: 40, y: 800, size: 10 });
  return doc.save();
}

// --- targetSize / sanitizeFileName / sniffAllowed --------------------------

test("targetSize: reduz mantendo proporção e nunca amplia", () => {
  assert.deepEqual(targetSize(4000, 3000, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(targetSize(3000, 4000, 2000), { width: 1500, height: 2000 });
  assert.deepEqual(targetSize(800, 600, 2000), { width: 800, height: 600 });
});

test("sanitizeFileName: limpa, aplica fallback e troca a extensão", () => {
  assert.equal(sanitizeFileName("  laudo médico (1).jpg "), "laudo_m_dico__1_.jpg");
  assert.equal(sanitizeFileName(""), "arquivo");
  assert.equal(sanitizeFileName("", { fallback: "arquivo.pdf" }), "arquivo.pdf");
  assert.equal(sanitizeFileName("foto.final.PNG", { ext: "webp" }), "foto.final.webp");
  assert.equal(sanitizeFileName("sem-extensao", { ext: "pdf" }), "sem-extensao.pdf");
  assert.equal(sanitizeFileName("", { ext: "pdf", fallback: "arquivo.pdf" }), "arquivo.pdf");
});

test("sniffAllowed: usa os bytes, não o nome nem o file.type", async () => {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.deepEqual(sniffAllowed(png, DOCUMENT_UPLOAD_MIMES), { mime: "image/png", ext: "png" });
  assert.equal(sniffAllowed(new TextEncoder().encode("<html>nada a ver</html>"), DOCUMENT_UPLOAD_MIMES), null);
  assert.equal(sniffAllowed(Buffer.from("GIF89a\u0001\u0000"), DOCUMENT_UPLOAD_MIMES), null);
});

// --- Imagens ---------------------------------------------------------------

test("compressImage: PNG grande vira WebP bem menor, redimensionado ao preset", async () => {
  const png = await sharp(noise(3000, 2000), { raw: { width: 3000, height: 2000, channels: 3 } }).png().toBuffer();
  const out = await compressImage(new Blob([new Uint8Array(png)], { type: "image/png" }), "foto", sharpBackend);
  assert.ok(out);
  assert.equal(out.mime, "image/webp");
  assert.equal(out.ext, "webp");
  assert.ok(out.blob.size < png.length * 0.5, `webp ${out.blob.size} vs png ${png.length}`);
  const meta = await sharp(Buffer.from(await out.blob.arrayBuffer())).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 1067);
});

test("compressImage: aplica a orientação EXIF (foto de celular deitada)", async () => {
  const jpeg = await sharp(noise(600, 300), { raw: { width: 600, height: 300, channels: 3 } })
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const out = await compressImage(new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "documento", sharpBackend);
  assert.ok(out);
  const meta = await sharp(Buffer.from(await out.blob.arrayBuffer())).metadata();
  assert.equal(meta.width, 300);
  assert.equal(meta.height, 600);
});

test("compressImage: PNG com transparência mantém o canal alfa no WebP", async () => {
  const rgba = noise(400, 400, 4);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = i % 8 === 3 ? 0 : 255;
  const png = await sharp(rgba, { raw: { width: 400, height: 400, channels: 4 } }).png().toBuffer();
  const out = await compressImage(new Blob([new Uint8Array(png)], { type: "image/png" }), "foto", sharpBackend);
  assert.ok(out);
  assert.equal(out.mime, "image/webp");
  const meta = await sharp(Buffer.from(await out.blob.arrayBuffer())).metadata();
  assert.equal(meta.hasAlpha, true);
});

test("compressImage: sem encoder WebP no navegador cai para JPEG", async () => {
  const noWebp: ImageBackend = async (file, maxSide, opaque) => {
    const rendered = await sharpBackend(file, maxSide, opaque);
    if (!rendered) return null;
    return {
      ...rendered,
      // Safari antigo: toBlob('image/webp') devolve PNG.
      encode: async (mime, q) => (mime === "image/webp" ? new Blob([new Uint8Array(4)], { type: "image/png" }) : rendered.encode(mime, q)),
    };
  };
  const png = await sharp(noise(500, 500), { raw: { width: 500, height: 500, channels: 3 } }).png().toBuffer();
  const out = await compressImage(new Blob([new Uint8Array(png)], { type: "image/png" }), "foto", noWebp);
  assert.ok(out);
  assert.equal(out.mime, "image/jpeg");
  assert.equal(out.ext, "jpg");
});

test("compressImage: resultado maior que o JPEG original devolve o original", async () => {
  const tiny = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#808080" } }).jpeg({ quality: 40 }).toBuffer();
  const blob = new Blob([new Uint8Array(tiny)], { type: "image/jpeg" });
  const bigger: ImageBackend = async () => ({
    width: 64,
    height: 64,
    encode: async (mime) => new Blob([new Uint8Array(tiny.length + 500)], { type: mime }),
  });
  const out = await compressImage(blob, "foto", bigger);
  assert.ok(out);
  assert.equal(out.blob, blob);
  assert.equal(out.mime, "image/jpeg");
});

test("prepareUpload: roteia pelo conteúdo real e corrige o nome; GIF/HEIC/lixo passam intactos", async () => {
  const png = await sharp(noise(1200, 800), { raw: { width: 1200, height: 800, channels: 3 } }).png().toBuffer();
  // Nome e MIME mentem (.pdf / application/pdf), os bytes são PNG.
  const lying = new File([new Uint8Array(png)], "Laudo Final.pdf", { type: "application/pdf" });
  const prepared = await prepareUpload(lying, "documento", { imageBackend: sharpBackend });
  assert.equal(prepared.type, "image/webp");
  assert.equal(prepared.name, "Laudo_Final.webp");
  assert.ok(prepared.size < png.length);

  const gif = new File([Buffer.from("GIF89a\u0001\u0000\u0001\u0000")], "a.gif", { type: "image/gif" });
  assert.equal(await prepareUpload(gif, "foto", { imageBackend: sharpBackend }), gif);

  const heic = new File([new Uint8Array([0, 0, 0, 24, ...Buffer.from("ftypheic"), 0, 0, 0, 0])], "a.heic", { type: "image/heic" });
  assert.equal(await prepareUpload(heic, "foto", { imageBackend: sharpBackend }), heic);

  const svg = new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "a.svg", { type: "image/svg+xml" });
  assert.equal(await prepareUpload(svg, "foto", { imageBackend: sharpBackend }), svg);
});

test("prepareUpload: falha na compressão devolve o original (nunca bloqueia o envio)", async () => {
  const png = await sharp(noise(300, 300), { raw: { width: 300, height: 300, channels: 3 } }).png().toBuffer();
  const file = new File([new Uint8Array(png)], "x.png", { type: "image/png" });
  const boom: ImageBackend = async () => {
    throw new Error("canvas indisponível");
  };
  assert.equal(await prepareUpload(file, "foto", { imageBackend: boom }), file);
});

// --- PDF -------------------------------------------------------------------

test("compressPdf: PDF com imagem grande fica >= 15% menor e mantém o texto", async () => {
  const input = await pdfWithJpeg();
  const result = await compressPdf(input, sharpRecoder);
  assert.equal(result.changed, true);
  assert.ok(result.bytes.length <= input.length * 0.85, `${result.bytes.length} vs ${input.length}`);

  const reloaded = await PDFDocument.load(result.bytes);
  assert.equal(reloaded.getPageCount(), 1);
  // Imagem reduzida a <= 200 dpi (A4: 2339px no lado maior) e ainda JPEG.
  const images = reloaded.context.enumerateIndirectObjects().filter(([, o]) => "dict" in o && (o as { dict: { get: (n: PDFName) => unknown } }).dict.get(PDFName.of("Subtype")) === PDFName.of("Image"));
  assert.equal(images.length, 1);
  const dict = (images[0][1] as unknown as { dict: { lookup: (n: PDFName) => { asNumber(): number } } }).dict;
  assert.ok(dict.lookup(PDFName.of("Height")).asNumber() <= 2339);
  // O texto continua no conteúdo da página (não foi rasterizado).
  const text = await extractText(result.bytes);
  assert.match(text, /Texto do laudo/);
});

test("compressPdf: imagem Flate (PNG com predictor) também é recomprimida", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const png = await sharp(noise(1800, 2400), { raw: { width: 1800, height: 2400, channels: 3 } }).png().toBuffer();
  page.drawImage(await doc.embedPng(png), { x: 0, y: 0, width: 595, height: 842 });
  const input = await doc.save();
  const result = await compressPdf(input, sharpRecoder);
  assert.equal(result.changed, true);
  assert.ok(result.bytes.length <= input.length * 0.85);
});

test("compressPdf: PDF só de texto passa idêntico", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawText("Somente texto", { x: 50, y: 700 });
  const input = await doc.save();
  const result = await compressPdf(input, sharpRecoder);
  assert.equal(result.changed, false);
  assert.equal(result.bytes, input);
});

test("compressPdf: ganho abaixo de 15% devolve o original", async () => {
  const input = await pdfWithJpeg(1200, 1700);
  // Recoder que "recomprime" quase sem ganho: 5% menor.
  const stingy: JpegRecoder = async (src) => {
    if (src.kind !== "jpeg") return null;
    return { data: src.data.subarray(0, Math.floor(src.data.length * 0.88)), width: src.width, height: src.height };
  };
  const result = await compressPdf(input, stingy);
  assert.equal(result.changed, false);
  assert.equal(result.bytes, input);
});

test("compressPdf: PDF assinado digitalmente volta idêntico (mesmos bytes)", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawImage(await doc.embedJpg(await bigJpeg(2480, 3508)), { x: 0, y: 0, width: 595, height: 842 });
  const sig = doc.context.obj({
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange: [0, 10, 20, 30],
    Contents: PDFHexString.of("00"),
  });
  doc.catalog.set(PDFName.of("SigDictForTest"), doc.context.register(sig));
  // Assinatura em claro (como nos PDFs assinados reais): o scan de bytes pega.
  const plain = await doc.save({ useObjectStreams: false });
  assert.equal(isSignedOrEncryptedPdf(plain), true);
  const plainResult = await compressPdf(plain, sharpRecoder);
  assert.equal(plainResult.changed, false);
  assert.equal(plainResult.bytes, plain);

  // Dict de assinatura escondido em object stream: pego depois do load.
  const packed = await doc.save({ useObjectStreams: true });
  const result = await compressPdf(packed, sharpRecoder);
  assert.equal(result.changed, false);
  assert.equal(result.reason, "signed-or-encrypted");
  assert.equal(result.bytes, packed);
});

test("compressPdf: PDF criptografado (/Encrypt) volta idêntico", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawImage(await doc.embedJpg(await bigJpeg(2480, 3508)), { x: 0, y: 0, width: 595, height: 842 });
  const base = await doc.save();
  const input = Buffer.concat([Buffer.from(base), Buffer.from("\ntrailer\n<< /Encrypt 99 0 R >>\n")]);
  const result = await compressPdf(new Uint8Array(input), sharpRecoder);
  assert.equal(result.changed, false);
  assert.equal(result.bytes.length, input.length);
});

test("compressPdf: arquivo corrompido volta idêntico", async () => {
  const junk = new TextEncoder().encode("%PDF-1.4\nisto nao e um pdf valido\n%%EOF");
  const result = await compressPdf(junk, sharpRecoder);
  assert.equal(result.changed, false);
  assert.equal(result.bytes, junk);
});

test("prepareUpload: PDF recomprimido mantém nome .pdf e tipo application/pdf", async () => {
  const input = await pdfWithJpeg();
  const file = new File([input as BlobPart], "Laudo Escaneado.pdf", { type: "application/pdf" });
  const prepared = await prepareUpload(file, "documento", { pdf: (b) => compressPdf(b, sharpRecoder) });
  assert.equal(prepared.type, "application/pdf");
  assert.equal(prepared.name, "Laudo_Escaneado.pdf");
  assert.ok(prepared.size <= file.size * 0.85);
});

async function extractText(bytes: Uint8Array): Promise<string> {
  const { extractText: unpdfExtract, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await unpdfExtract(pdf, { mergePages: true });
  return text;
}

// --- Webhook Twilio (sharp no servidor) -----------------------------------

test("optimizeIncomingImage: PNG/JPEG viram WebP; HEIC, PDF e lixo ficam como estão", async () => {
  const png = await sharp(noise(2600, 1800), { raw: { width: 2600, height: 1800, channels: 3 } }).png().toBuffer();
  const out = await optimizeIncomingImage(png, "image/png");
  assert.equal(out.mime, "image/webp");
  assert.ok(out.buffer.length < png.length);
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 2200);

  // Content-Type mentiroso: decide pelos bytes.
  const lying = await optimizeIncomingImage(png, "application/pdf");
  assert.equal(lying.mime, "image/webp");

  const heic = Buffer.from([0, 0, 0, 24, ...Buffer.from("ftypheic"), 0, 0, 0, 0]);
  assert.deepEqual(await optimizeIncomingImage(heic, "image/heic"), { buffer: heic, mime: "image/heic" });
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
  assert.deepEqual(await optimizeIncomingImage(pdf, "application/pdf"), { buffer: pdf, mime: "application/pdf" });
});

test("optimizeIncomingImage: imagem corrompida ou estouro de tempo grava o original", async () => {
  const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("isto nao e um jpeg")]);
  assert.deepEqual(await optimizeIncomingImage(broken, "image/jpeg"), { buffer: broken, mime: "image/jpeg" });

  const png = await sharp(noise(2000, 2000), { raw: { width: 2000, height: 2000, channels: 3 } }).png().toBuffer();
  const timedOut = await optimizeIncomingImage(png, "image/png", 1);
  assert.deepEqual(timedOut, { buffer: png, mime: "image/png" });
});
