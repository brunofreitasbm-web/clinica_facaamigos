// tests/whatsapp-lead-pure.test.ts
//
// Funções puras do cadastro automático de lead por WhatsApp
// (lib/whatsapp-lead-pure.ts): tipo real do arquivo por magic bytes (o
// Content-Type do Twilio nunca vence o conteúdo), categoria do documento,
// caminho no Storage e validação da identidade do lead.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLeadStoragePath,
  coerceLeadKind,
  ensureExtension,
  isLeadIdentityComplete,
  kindToCategory,
  normalizeBirthDate,
  normalizeCpfDigits,
  normalizeEmail,
  normalizeFullName,
  pickLeadCandidate,
  sniffFileType,
  type LeadCandidate,
} from "../lib/whatsapp-lead-pure.ts";

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const bytes = (...parts: number[][]) => new Uint8Array(parts.flat());

test("sniffFileType: PDF, JPEG, PNG, WEBP, GIF e HEIC/HEIF", () => {
  assert.deepEqual(sniffFileType(bytes(ascii("%PDF-1.7\n"), [1, 2, 3])), { mime: "application/pdf", ext: "pdf" });
  assert.deepEqual(sniffFileType(bytes([0xff, 0xd8, 0xff, 0xe0], [0, 16])), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(sniffFileType(bytes([0x89], ascii("PNG"), [0x0d, 0x0a, 0x1a, 0x0a], [0, 0])), {
    mime: "image/png",
    ext: "png",
  });
  assert.deepEqual(sniffFileType(bytes(ascii("RIFF"), [1, 2, 3, 4], ascii("WEBPVP8 "))), { mime: "image/webp", ext: "webp" });
  assert.deepEqual(sniffFileType(bytes(ascii("GIF89a"), [1, 0])), { mime: "image/gif", ext: "gif" });
  assert.deepEqual(sniffFileType(bytes([0, 0, 0, 24], ascii("ftypheic"), [0, 0])), { mime: "image/heic", ext: "heic" });
  assert.deepEqual(sniffFileType(bytes([0, 0, 0, 24], ascii("ftypmif1"), [0, 0])), { mime: "image/heif", ext: "heif" });
});

test("sniffFileType: JPEG rotulado como PDF continua sendo JPEG (o conteúdo vence o header)", () => {
  // O chamador poderia ter `contentTypeHint: "application/pdf"`; o sniff só olha os bytes.
  const jpegSaidToBePdf = bytes([0xff, 0xd8, 0xff, 0xdb], new Array(32).fill(7));
  const sniffed = sniffFileType(jpegSaidToBePdf);
  assert.equal(sniffed?.mime, "image/jpeg");
  assert.equal(sniffed?.ext, "jpg");
});

test("sniffFileType: conteúdo desconhecido, vazio ou curto demais vira null", () => {
  assert.equal(sniffFileType(new Uint8Array()), null);
  assert.equal(sniffFileType(new Uint8Array([1, 2])), null);
  assert.equal(sniffFileType(bytes(ascii("<html><body>oi</body></html>"))), null);
  assert.equal(sniffFileType(bytes([0, 0, 0, 24], ascii("ftypmp42"), [0, 0])), null);
});

test("kindToCategory: guia vira autorizacao, o resto mantém o nome", () => {
  assert.equal(kindToCategory("guia"), "autorizacao");
  assert.equal(kindToCategory("laudo"), "laudo");
  assert.equal(kindToCategory("carteirinha"), "carteirinha");
  assert.equal(kindToCategory("pedido_medico"), "pedido_medico");
  assert.equal(kindToCategory("certidao_nascimento"), "certidao_nascimento");
  assert.equal(kindToCategory("documento_identidade"), "documento_identidade");
  assert.equal(kindToCategory("comprovante_residencia"), "comprovante_residencia");
  assert.equal(kindToCategory("outro"), "outro");
});

test("coerceLeadKind: aceita rótulos da extração (autorizacao => guia) e cai em outro", () => {
  assert.equal(coerceLeadKind("autorizacao"), "guia");
  assert.equal(coerceLeadKind("laudo"), "laudo");
  assert.equal(coerceLeadKind("qualquer-coisa"), "outro");
  assert.equal(coerceLeadKind(null), "outro");
});

test("buildLeadStoragePath: leads/<dígitos>/<epochms>-<kind>-<rand>.<ext>", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  assert.equal(
    buildLeadStoragePath({ phone: "+55 (91) 90000-0101", kind: "laudo", ext: "pdf", now, rand: "abc123" }),
    `leads/5591900000101/${now.getTime()}-laudo-abc123.pdf`,
  );
  assert.match(
    buildLeadStoragePath({ phone: "+5591900000101", kind: "guia", ext: ".JPG" }),
    /^leads\/5591900000101\/\d{13}-guia-[a-z0-9]{6}\.jpg$/,
  );
  assert.equal(
    buildLeadStoragePath({ phone: "+5591900000101", kind: "outro", ext: "png", pending: true, stableKey: "deadbeef" }),
    "leads/pending/5591900000101/deadbeef-outro.png",
  );
});

test("ensureExtension: troca a extensão pela do tipo real", () => {
  assert.equal(ensureExtension("laudo.pdf", "jpg"), "laudo.jpg");
  assert.equal(ensureExtension("foto", "png"), "foto.png");
});

test("normalizeFullName: exige 2+ palavras", () => {
  assert.equal(normalizeFullName("  Maria   Souza "), "Maria Souza");
  assert.equal(normalizeFullName("Maria"), null);
  assert.equal(normalizeFullName("Maria 123"), null);
  assert.equal(normalizeFullName(null), null);
  assert.equal(normalizeFullName("ok"), null);
});

test("normalizeBirthDate: ISO/BR válidos, recusa inválida e futura", () => {
  const now = new Date("2026-09-20T15:00:00.000Z");
  assert.equal(normalizeBirthDate("2019-03-12", now), "2019-03-12");
  assert.equal(normalizeBirthDate("12/03/2019", now), "2019-03-12");
  assert.equal(normalizeBirthDate("1/3/2019", now), "2019-03-01");
  assert.equal(normalizeBirthDate("31/02/2019", now), null);
  assert.equal(normalizeBirthDate("2026-09-21", now), null);
  assert.equal(normalizeBirthDate("2026-09-20", now), "2026-09-20");
  assert.equal(normalizeBirthDate("1850-01-01", now), null);
  assert.equal(normalizeBirthDate("ontem", now), null);
  assert.equal(normalizeBirthDate(undefined, now), null);
});

test("normalizeCpfDigits: 11 dígitos, recusa repetido", () => {
  assert.equal(normalizeCpfDigits("529.982.247-25"), "52998224725");
  assert.equal(normalizeCpfDigits("123"), null);
  assert.equal(normalizeCpfDigits("111.111.111-11"), null);
  assert.equal(normalizeCpfDigits(null), null);
});

test("normalizeEmail", () => {
  assert.equal(normalizeEmail(" Mae@Exemplo.COM "), "mae@exemplo.com");
  assert.equal(normalizeEmail("sem-arroba"), null);
});

test("isLeadIdentityComplete: precisa de nome completo E nascimento válido", () => {
  assert.equal(isLeadIdentityComplete({ childName: "Ana Lima", childBirthDate: "2020-05-01" }), true);
  assert.equal(isLeadIdentityComplete({ childName: "Ana", childBirthDate: "2020-05-01" }), false);
  assert.equal(isLeadIdentityComplete({ childName: "Ana Lima", childBirthDate: "2999-01-01" }), false);
  assert.equal(isLeadIdentityComplete({ childName: "Ana Lima" }), false);
  assert.equal(isLeadIdentityComplete({}), false);
});

test("pickLeadCandidate: irmãos no mesmo telefone não se misturam", () => {
  const a: LeadCandidate = { patientId: "a", fullName: "Ana Lima", birthDate: "2020-05-01", status: "ativo", createdAt: "2026-01-01" };
  const b: LeadCandidate = { patientId: "b", fullName: "Beto Lima", birthDate: "2022-07-09", status: "interessado", createdAt: "2026-09-01" };
  assert.equal(pickLeadCandidate([a, b], { childBirthDate: "2022-07-09" })?.patientId, "b");
  assert.equal(pickLeadCandidate([a, b], { childName: "Ana Lima", childBirthDate: "2020-05-01" })?.patientId, "a");
  // Nascimento de uma terceira criança: nenhum casa -> null (cria lead novo ou vai p/ pendentes).
  assert.equal(pickLeadCandidate([a, b], { childName: "Caio Lima", childBirthDate: "2018-01-01" }), null);
  assert.equal(pickLeadCandidate([a, b], { childName: "Beto Lima" })?.patientId, "b");
  assert.equal(pickLeadCandidate([a, b], { childName: "Caio Lima" }), null);
  // Sem dados: prefere o lead "interessado" mais recente.
  assert.equal(pickLeadCandidate([a, b], {})?.patientId, "b");
  assert.equal(pickLeadCandidate([], {}), null);
});
