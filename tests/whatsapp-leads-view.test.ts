// tests/whatsapp-leads-view.test.ts
//
// Lógica pura do painel "Leads via WhatsApp" da Supervisão
// (lib/whatsapp-leads-view.ts): máscara de CPF, link wa.me, tipo de arquivo,
// selo de completude e leitura defensiva do JSON extraído pela IA.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maskCpf,
  whatsappLink,
  formatPhoneDisplay,
  fileKind,
  computeCompleteness,
  requestStatusLabel,
  draftStatusLabel,
  summarizeDraftExtraction,
  arrivalIso,
} from "../lib/whatsapp-leads-view.ts";

test("maskCpf esconde o começo e o fim", () => {
  assert.equal(maskCpf("12345678901"), "***.456.789-**");
  assert.equal(maskCpf("123.456.789-01"), "***.456.789-**");
  assert.equal(maskCpf(null), null);
  assert.equal(maskCpf(""), null);
  assert.equal(maskCpf("123"), "***");
});

test("whatsappLink usa só dígitos e recusa telefone inválido", () => {
  assert.equal(whatsappLink("+5591900000202"), "https://wa.me/5591900000202");
  assert.equal(whatsappLink("+55 (91) 90000-0202"), "https://wa.me/5591900000202");
  assert.equal(whatsappLink("91985579268"), "https://wa.me/5591985579268");
  assert.equal(whatsappLink("(91) 8557-9268"), "https://wa.me/559185579268");
  assert.equal(whatsappLink("123"), null);
  assert.equal(whatsappLink(null), null);
});

test("formatPhoneDisplay formata E.164 brasileiro", () => {
  assert.equal(formatPhoneDisplay("+5591900000202"), "+55 (91) 90000-0202");
  assert.equal(formatPhoneDisplay("+559130000202"), "+55 (91) 3000-0202");
  assert.equal(formatPhoneDisplay("91985579268"), "+55 (91) 98557-9268");
  assert.equal(formatPhoneDisplay("+14155550100"), "+14155550100");
  assert.equal(formatPhoneDisplay(null), "—");
});

test("fileKind distingue PDF, foto e outros", () => {
  assert.equal(fileKind("application/pdf"), "PDF");
  assert.equal(fileKind("image/jpeg"), "Foto");
  assert.equal(fileKind(null, "laudo.PDF"), "PDF");
  assert.equal(fileKind(null, "foto.heic"), "Foto");
  assert.equal(fileKind("application/zip", "x.zip"), "Arquivo");
  assert.equal(fileKind(null, null), "Arquivo");
});

test("computeCompleteness lista o que falta", () => {
  const full = computeCompleteness({
    birthDate: "2020-01-01",
    guardianName: "Ana",
    guardianCpf: "12345678901",
    guardianEmail: "a@b.com",
    hasInsurance: true,
    isPrivate: false,
    cardNumber: "0001",
  });
  assert.deepEqual(full, { complete: true, missing: [], label: "Dados completos" });

  const partial = computeCompleteness({
    birthDate: "2020-01-01",
    guardianName: "Ana",
    guardianCpf: null,
    guardianEmail: "  ",
    hasInsurance: false,
    isPrivate: false,
    cardNumber: null,
  });
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.missing, ["CPF", "e-mail", "convênio/cartão"]);
  assert.equal(partial.label, "Faltam: CPF, e-mail, convênio/cartão");
});

test("computeCompleteness não exige cartão em atendimento particular", () => {
  const r = computeCompleteness({
    birthDate: "2020-01-01",
    guardianName: "Ana",
    guardianCpf: "12345678901",
    guardianEmail: "a@b.com",
    hasInsurance: true,
    isPrivate: true,
    cardNumber: null,
  });
  assert.equal(r.complete, true);
});

test("rótulos de status", () => {
  assert.equal(requestStatusLabel("pendente_supervisor"), "Documentos para validar");
  assert.equal(requestStatusLabel(null), "Sem solicitação de agendamento");
  assert.equal(requestStatusLabel("novo_status"), "novo_status");
  assert.equal(draftStatusLabel("processing"), "Lendo documento com IA…");
  assert.equal(draftStatusLabel("extracted"), "Pronto para conferir");
  assert.equal(draftStatusLabel("failed"), "Falhou");
});

test("summarizeDraftExtraction tolera JSON ausente ou malformado", () => {
  const empty = summarizeDraftExtraction(null);
  assert.equal(empty.childName, null);
  assert.equal(summarizeDraftExtraction("lixo").guardianName, null);
  assert.equal(summarizeDraftExtraction([]).birthDate, null);

  const s = summarizeDraftExtraction({
    patient: { full_name: " Maria ", birth_date: "2019-05-04", cid: null },
    guardian: { full_name: "Joana", email: "" },
    insurance: { insurer_name: "Unimed", card_number: 123 },
  });
  assert.equal(s.childName, "Maria");
  assert.equal(s.birthDate, "2019-05-04");
  assert.equal(s.cid, null);
  assert.equal(s.guardianName, "Joana");
  assert.equal(s.guardianEmail, null);
  assert.equal(s.insurerName, "Unimed");
  assert.equal(s.cardNumber, null);
});

test("arrivalIso prefere first_contact_at", () => {
  assert.equal(arrivalIso("2026-09-01T10:00:00Z", "2026-09-02T10:00:00Z"), "2026-09-01T10:00:00Z");
  assert.equal(arrivalIso(null, "2026-09-02T10:00:00Z"), "2026-09-02T10:00:00Z");
  assert.equal(arrivalIso(null, null), null);
});
