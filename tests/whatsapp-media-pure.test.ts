// tests/whatsapp-media-pure.test.ts
//
// Decisões puras do recebimento de mídia por WhatsApp (lib/whatsapp-media-pure.ts):
// mídia "a frio", ponteiro `storage://` do bot de anamnese e o que fazer com o
// resultado de salvar os anexos (nunca avançar etapa sem arquivo salvo).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStoragePointer,
  coldPatientReply,
  collectMediaItems,
  filterIngestibleMedia,
  isAudioOnlyMessage,
  isPdfPointer,
  planColdMedia,
  splitCardPointers,
  summarizeMediaSave,
  RETRY_MEDIA_REPLY,
  UNSUPPORTED_MEDIA_REPLY,
} from "../lib/whatsapp-media-pure.ts";
import { parseStoredFileRef } from "../lib/file-access.ts";

test("ponteiro storage:// aponta para o bucket privado e é lido por parseStoredFileRef", () => {
  const pointer = buildStoragePointer("leads/5591900000303/1758000000000-laudo-ab12cd.jpg");
  assert.equal(pointer, "storage://clinic-documents/leads/5591900000303/1758000000000-laudo-ab12cd.jpg");
  assert.deepEqual(parseStoredFileRef(pointer), {
    kind: "private",
    bucket: "clinic-documents",
    path: "leads/5591900000303/1758000000000-laudo-ab12cd.jpg",
  });
  // barra inicial não vira "storage://clinic-documents//..."
  assert.equal(buildStoragePointer("/a/b.pdf"), "storage://clinic-documents/a/b.pdf");
});

test("isPdfPointer olha a extensão do objeto (que veio do tipo REAL do arquivo)", () => {
  assert.equal(isPdfPointer(buildStoragePointer("leads/1/1-laudo-x.pdf")), true);
  assert.equal(isPdfPointer(buildStoragePointer("leads/1/1-laudo-x.jpg")), false);
  assert.equal(isPdfPointer(null), false);
});

test("collectMediaItems: usa todos os anexos; sem lista cai em mediaUrl0", () => {
  const all = collectMediaItems({
    media: [{ url: "https://a/1", contentType: "image/jpeg" }, { url: "https://a/2" }],
    mediaUrl0: "https://a/1",
  });
  assert.equal(all.length, 2);
  assert.deepEqual(collectMediaItems({ mediaUrl0: "https://a/1", mediaContentType0: "application/pdf" }), [
    { url: "https://a/1", contentType: "application/pdf" },
  ]);
  assert.deepEqual(collectMediaItems({ media: [], mediaUrl0: "" }), []);
});

test("filterIngestibleMedia: foto/PDF entram; áudio e vídeo ficam de fora", () => {
  const kept = filterIngestibleMedia([
    { url: "u1", contentType: "image/jpeg" },
    { url: "u2", contentType: "application/pdf" },
    { url: "u3", contentType: "audio/ogg" },
    { url: "u4", contentType: "video/mp4" },
    { url: "u5" },
    { url: "u6", contentType: "application/pdf; charset=binary" },
  ]);
  assert.deepEqual(kept.map((m) => m.url), ["u1", "u2", "u5", "u6"]);
});

test("planColdMedia: sem mídia ou com outro bot esperando o anexo, não intercepta", () => {
  assert.deepEqual(planColdMedia({ mediaCount: 0, awaitingAttachmentDirectly: false, botActive: true, knownPatient: false }), {
    action: "skip",
  });
  assert.deepEqual(planColdMedia({ mediaCount: 1, awaitingAttachmentDirectly: true, botActive: true, knownPatient: false }), {
    action: "skip",
  });
});

test("planColdMedia: PDF 'do nada' de telefone desconhecido vira rascunho, sem exigir gatilho nem fluxo", () => {
  assert.deepEqual(planColdMedia({ mediaCount: 1, awaitingAttachmentDirectly: false, botActive: true, knownPatient: false }), {
    action: "ingest",
    silent: false,
    target: "draft",
  });
});

test("planColdMedia: responsável já cadastrado anexa direto ao paciente", () => {
  const plan = planColdMedia({ mediaCount: 2, awaitingAttachmentDirectly: false, botActive: true, knownPatient: true });
  assert.deepEqual(plan, { action: "ingest", silent: false, target: "patient" });
});

test("planColdMedia: conversa com humano ingere em silêncio (não exige is_bot_active)", () => {
  assert.deepEqual(planColdMedia({ mediaCount: 1, awaitingAttachmentDirectly: false, botActive: false, knownPatient: false }), {
    action: "ingest",
    silent: true,
    target: "draft",
  });
  assert.deepEqual(planColdMedia({ mediaCount: 1, awaitingAttachmentDirectly: false, botActive: false, knownPatient: true }), {
    action: "ingest",
    silent: true,
    target: "patient",
  });
});

const counts = (over: Partial<Parameters<typeof summarizeMediaSave>[0]> = {}) => ({
  saved: 0,
  duplicates: 0,
  unsupported: 0,
  failed: 0,
  adopted: 0,
  storagePaths: [] as string[],
  ...over,
});

test("summarizeMediaSave: nada salvo NÃO avança — falha técnica pede reenvio", () => {
  assert.deepEqual(summarizeMediaSave(counts({ failed: 1 })), { status: "retry" });
  assert.deepEqual(summarizeMediaSave(counts()), { status: "retry" });
});

test("summarizeMediaSave: formato não suportado sem nenhum arquivo salvo → mensagem de formato", () => {
  assert.deepEqual(summarizeMediaSave(counts({ unsupported: 1 })), { status: "unsupported" });
  assert.match(UNSUPPORTED_MEDIA_REPLY, /fotos \(JPG\/PNG\) e PDF/);
  assert.match(RETRY_MEDIA_REPLY, /25MB/);
});

test("summarizeMediaSave: salvou → ponteiros storage:// só dos arquivos da mensagem (sem os pendentes adotados)", () => {
  const summary = summarizeMediaSave(
    counts({ saved: 1, adopted: 1, storagePaths: ["leads/55/old-outro.pdf", "leads/55/new-laudo.jpg"] }),
  );
  assert.deepEqual(summary, {
    status: "saved",
    pointers: ["storage://clinic-documents/leads/55/new-laudo.jpg"],
    unsupportedNote: false,
  });
});

test("summarizeMediaSave: reentrega (duplicata) conta como salvo; um arquivo ruim junto só gera aviso", () => {
  const summary = summarizeMediaSave(counts({ duplicates: 1, unsupported: 1, storagePaths: ["leads/55/a-laudo.pdf"] }));
  assert.equal(summary.status, "saved");
  if (summary.status === "saved") {
    assert.deepEqual(summary.pointers, ["storage://clinic-documents/leads/55/a-laudo.pdf"]);
    assert.equal(summary.unsupportedNote, true);
  }
});

test("splitCardPointers: PDF único cobre frente e verso", () => {
  const pdf = buildStoragePointer("leads/1/1-carteirinha-x.pdf");
  assert.deepEqual(splitCardPointers([pdf]), { front: pdf, back: pdf });
});

test("splitCardPointers: duas fotos na mesma mensagem = frente e verso", () => {
  const a = buildStoragePointer("leads/1/1-carteirinha-a.jpg");
  const b = buildStoragePointer("leads/1/2-carteirinha-b.jpg");
  assert.deepEqual(splitCardPointers([a, b]), { front: a, back: b });
});

test("splitCardPointers: uma foto só deixa o verso pendente", () => {
  const a = buildStoragePointer("leads/1/1-carteirinha-a.jpg");
  assert.deepEqual(splitCardPointers([a]), { front: a, back: null });
});

test("coldPatientReply: confirma quando salvou; pede reenvio quando não", () => {
  assert.match(coldPatientReply({ saved: 1, duplicates: 0, unsupported: 0 }), /Recebido/);
  assert.equal(coldPatientReply({ saved: 0, duplicates: 0, unsupported: 1 }), UNSUPPORTED_MEDIA_REPLY);
  assert.equal(coldPatientReply({ saved: 0, duplicates: 0, unsupported: 0 }), RETRY_MEDIA_REPLY);
});

test("nota de voz sozinha é identificada como mensagem de áudio", () => {
  assert.equal(isAudioOnlyMessage([{ url: "u", contentType: "audio/ogg; codecs=opus" }], ""), true);
  assert.equal(isAudioOnlyMessage([{ url: "u", contentType: "audio/mpeg" }], "   "), true);
});

test("áudio com legenda de texto ou junto de outra mídia segue o fluxo normal", () => {
  assert.equal(isAudioOnlyMessage([{ url: "u", contentType: "audio/ogg" }], "segue o áudio"), false);
  assert.equal(
    isAudioOnlyMessage([{ url: "a", contentType: "audio/ogg" }, { url: "b", contentType: "image/jpeg" }], ""),
    false,
  );
  assert.equal(isAudioOnlyMessage([], ""), false);
});
