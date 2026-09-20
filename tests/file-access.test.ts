// tests/file-access.test.ts
//
// Lógica pura de /api/arquivos/* (lib/file-access.ts): interpretação do valor
// gravado nas colunas *_url da anamnese, mapa slot → coluna e detecção do
// tipo real por magic bytes (objetos legados são JPEG gravados como
// application/pdf).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANAMNESIS_SLOT_COLUMN,
  detectFileType,
  downloadFileName,
  isAnamnesisSlot,
  parseStoredFileRef,
} from "../lib/file-access.ts";

test("slot → coluna cobre os quatro documentos da anamnese", () => {
  assert.deepEqual(ANAMNESIS_SLOT_COLUMN, {
    laudo: "laudo_pdf_url",
    guia: "guia_pdf_url",
    carteirinha_frente: "carteirinha_frente_url",
    carteirinha_verso: "carteirinha_verso_url",
  });
  assert.equal(isAnamnesisSlot("laudo"), true);
  assert.equal(isAnamnesisSlot("carteirinha_verso"), true);
  assert.equal(isAnamnesisSlot("outro"), false);
  assert.equal(isAnamnesisSlot("toString"), false);
  assert.equal(isAnamnesisSlot("__proto__"), false);
});

test("storage://clinic-documents/<path> vira referência privada", () => {
  assert.deepEqual(parseStoredFileRef("storage://clinic-documents/whatsapp/abc/laudo.pdf"), {
    kind: "private",
    bucket: "clinic-documents",
    path: "whatsapp/abc/laudo.pdf",
  });
});

test("storage:// de outro bucket, path vazio ou com .. não é aceito", () => {
  assert.equal(parseStoredFileRef("storage://outro-bucket/x.pdf").kind, "unsupported");
  assert.equal(parseStoredFileRef("storage://clinic-documents/").kind, "unsupported");
  assert.equal(parseStoredFileRef("storage://clinic-documents/../segredo.pdf").kind, "unsupported");
  assert.equal(parseStoredFileRef("storage://clinic-documents/a//b.pdf").kind, "unsupported");
});

test("URL pública legada de patient-documents extrai o path (com + e %2B preservados)", () => {
  const url =
    "https://vththexblpxwocbowhsv.supabase.co/storage/v1/object/public/patient-documents/anamnese-laudos-guias/1789569126501_laudo_+559189371732.pdf";
  assert.deepEqual(parseStoredFileRef(url), {
    kind: "legacy",
    bucket: "patient-documents",
    path: "anamnese-laudos-guias/1789569126501_laudo_+559189371732.pdf",
  });

  const encoded =
    "https://x.supabase.co/storage/v1/object/public/patient-documents/pasta/Guia%20da%20Ana.pdf?t=123";
  assert.deepEqual(parseStoredFileRef(encoded), {
    kind: "legacy",
    bucket: "patient-documents",
    path: "pasta/Guia da Ana.pdf",
  });
});

test("URL de outro bucket público, do Twilio ou lixo não é suportada", () => {
  assert.equal(
    parseStoredFileRef("https://x.supabase.co/storage/v1/object/public/outro/arquivo.pdf").kind,
    "unsupported",
  );
  assert.equal(
    parseStoredFileRef("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1").kind,
    "unsupported",
  );
  assert.equal(parseStoredFileRef("https://www.w3.org/dummy.pdf").kind, "unsupported");
  assert.equal(parseStoredFileRef("javascript:alert(1)").kind, "unsupported");
  assert.equal(parseStoredFileRef("não é url").kind, "unsupported");
  assert.equal(parseStoredFileRef("").kind, "unsupported");
  assert.equal(parseStoredFileRef(null).kind, "unsupported");
  assert.equal(parseStoredFileRef(undefined).kind, "unsupported");
});

test("URL legada nunca devolve path com .. e percent-encoding inválido é recusado", () => {
  // O parser de URL já resolve %2E%2E antes de chegarmos aqui — o que importa é o resultado nunca conter "..".
  const ref = parseStoredFileRef(
    "https://x.supabase.co/storage/v1/object/public/patient-documents/a/%2E%2E/b.pdf",
  );
  if (ref.kind !== "unsupported") assert.equal(ref.path.split("/").includes(".."), false);
  assert.equal(
    parseStoredFileRef("https://x.supabase.co/storage/v1/object/public/patient-documents/%E0%A4%A").kind,
    "unsupported",
  );
});

test("detectFileType reconhece pdf, jpeg, png, webp e gif pelos bytes", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  assert.deepEqual(detectFileType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37)), {
    mime: "application/pdf",
    ext: "pdf",
  });
  assert.deepEqual(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10)), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), {
    mime: "image/png",
    ext: "png",
  });
  assert.deepEqual(
    detectFileType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56)),
    { mime: "image/webp", ext: "webp" },
  );
  assert.deepEqual(detectFileType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), { mime: "image/gif", ext: "gif" });
});

test("detectFileType tolera lixo antes do %PDF- e devolve null para o desconhecido", () => {
  const withGarbage = new Uint8Array([0x0a, 0x0a, 0x20, 0x25, 0x50, 0x44, 0x46, 0x2d]);
  assert.equal(detectFileType(withGarbage)?.mime, "application/pdf");
  assert.equal(detectFileType(new Uint8Array([1, 2, 3, 4])), null);
  assert.equal(detectFileType(new Uint8Array([])), null);
  // RIFF de outro tipo (ex.: WAV) não é webp.
  assert.equal(
    detectFileType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45])),
    null,
  );
});

test("downloadFileName sanitiza e troca a extensão pela do tipo real", () => {
  assert.equal(
    downloadFileName("anamnese-laudos-guias/1789569126501_laudo_+559189371732.pdf", "jpg"),
    "1789569126501_laudo__559189371732.jpg",
  );
  assert.equal(downloadFileName("a/b/Guia da Ana.pdf", "pdf"), "Guia_da_Ana.pdf");
  assert.equal(downloadFileName("a/semextensao", "png"), "semextensao.png");
  assert.equal(downloadFileName("a/x.pdf", null), "x.pdf");
});
