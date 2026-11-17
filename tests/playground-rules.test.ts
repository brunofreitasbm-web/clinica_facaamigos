// tests/playground-rules.test.ts
//
// Regras da avaliação paralela no playground: status da visita (prazo de 40
// min depois da saída, virada do dia), janela do dia, assinatura HMAC entre
// PDV e clínica, nomes na lista e snapshot da conclusão.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVisitStatus, isConclusionPending, type PlaygroundVisitInput } from "../lib/playground/status.ts";
import { isSavedAtPlausible, isSavedOnVisitDay } from "../lib/playground/window.ts";
import { signBridgeBody, verifyBridgeSignature } from "../lib/playground/bridge-auth.ts";
import { ageLabel, buildDisplayNames } from "../lib/playground/display.ts";
import { buildSnapshotScores } from "../lib/playground/snapshot.ts";

const TZ = "America/Sao_Paulo";
// 14h30 em São Paulo (UTC-3) = 17h30 UTC.
const START = "2026-11-17T17:30:00.000Z";

function visit(overrides: Partial<PlaygroundVisitInput> = {}): PlaygroundVisitInput {
  return {
    scheduledStart: START,
    durationMin: 60,
    arrivedAt: null,
    leftAt: null,
    cancelledAt: null,
    firstEntryAt: null,
    ...overrides,
  };
}
const at = (iso: string) => new Date(iso);

test("status: antes da chegada, no playground, confirmar saída, avaliar agora, atrasada", () => {
  assert.equal(computeVisitStatus(visit(), at("2026-11-17T17:00:00Z"), TZ), "aguardando_chegada");
  const arrived = visit({ arrivedAt: "2026-11-17T17:35:00Z" });
  assert.equal(computeVisitStatus(arrived, at("2026-11-17T18:00:00Z"), TZ), "no_playground");
  // Terminou às 18h30Z e ninguém marcou a saída.
  assert.equal(computeVisitStatus(arrived, at("2026-11-17T18:31:00Z"), TZ), "confirmar_saida");
  const left = visit({ arrivedAt: "2026-11-17T17:35:00Z", leftAt: "2026-11-17T18:30:00Z" });
  assert.equal(computeVisitStatus(left, at("2026-11-17T18:50:00Z"), TZ), "avaliar_agora");
});

test("status: fronteira exata dos 40 minutos vira atrasada", () => {
  const left = visit({ arrivedAt: "2026-11-17T17:35:00Z", leftAt: "2026-11-17T18:30:00Z" });
  assert.equal(computeVisitStatus(left, at("2026-11-17T19:09:59Z"), TZ), "avaliar_agora");
  assert.equal(computeVisitStatus(left, at("2026-11-17T19:10:00Z"), TZ), "atrasada");
});

test("status: primeira entrada registra a visita, no prazo ou com atraso", () => {
  const base = { arrivedAt: "2026-11-17T17:35:00Z", leftAt: "2026-11-17T18:30:00Z" };
  assert.equal(
    computeVisitStatus(visit({ ...base, firstEntryAt: "2026-11-17T18:55:00Z" }), at("2026-11-17T20:00:00Z"), TZ),
    "registrada_no_prazo",
  );
  assert.equal(
    computeVisitStatus(visit({ ...base, firstEntryAt: "2026-11-17T19:30:00Z" }), at("2026-11-17T20:00:00Z"), TZ),
    "registrada_com_atraso",
  );
});

test("status: virada do dia em America/Sao_Paulo (não em UTC)", () => {
  const arrived = visit({ arrivedAt: "2026-11-17T17:35:00Z", leftAt: "2026-11-17T18:30:00Z" });
  // 23h50 em SP ainda é o mesmo dia (02h50Z do dia 18).
  assert.equal(computeVisitStatus(arrived, at("2026-11-18T02:50:00Z"), TZ), "atrasada");
  // 00h10 em SP do dia 18: o dia acabou.
  assert.equal(computeVisitStatus(arrived, at("2026-11-18T03:10:00Z"), TZ), "nao_feita");
  assert.equal(computeVisitStatus(visit(), at("2026-11-18T03:10:00Z"), TZ), "faltou");
});

test("status: saída nunca confirmada também vira Não feita no fim do dia", () => {
  const arrived = visit({ arrivedAt: "2026-11-17T17:35:00Z" });
  assert.equal(computeVisitStatus(arrived, at("2026-11-18T03:10:00Z"), TZ), "nao_feita");
});

test("status: visita futura e cancelada", () => {
  assert.equal(computeVisitStatus(visit(), at("2026-11-10T12:00:00Z"), TZ), "futura");
  assert.equal(computeVisitStatus(visit({ cancelledAt: "2026-11-16T12:00:00Z" }), at("2026-11-17T18:00:00Z"), TZ), "cancelada");
});

test("série: conclusão pendente só depois do dia da última visita agendada", () => {
  const series = { status: "liberada" as const, activeVisitStarts: ["2026-11-10T17:30:00Z", START] };
  assert.equal(isConclusionPending(series, at("2026-11-17T20:00:00Z"), TZ), false);
  assert.equal(isConclusionPending(series, at("2026-11-18T12:00:00Z"), TZ), true);
  assert.equal(isConclusionPending({ ...series, status: "concluida" }, at("2026-11-18T12:00:00Z"), TZ), false);
  assert.equal(isConclusionPending({ status: "liberada", activeVisitStarts: [] }, at("2026-11-18T12:00:00Z"), TZ), false);
});

test("janela: entrada salva hoje que só chegou amanhã vale; salva amanhã não vale", () => {
  assert.equal(isSavedOnVisitDay("2026-11-17T21:00:00Z", START, TZ), true); // 18h em SP
  assert.equal(isSavedOnVisitDay("2026-11-18T03:30:00Z", START, TZ), false); // 00h30 do dia 18 em SP
  assert.equal(isSavedOnVisitDay("lixo", START, TZ), false);
});

test("janela: saved_at muito no futuro é implausível", () => {
  const now = at("2026-11-17T18:00:00Z");
  assert.equal(isSavedAtPlausible("2026-11-17T18:02:00Z", now), true);
  assert.equal(isSavedAtPlausible("2026-11-17T18:30:00Z", now), false);
  assert.equal(isSavedAtPlausible("x", now), false);
});

test("HMAC: válido, adulterado, expirado e ausente", () => {
  const secret = "segredo-de-teste";
  const body = JSON.stringify({ a: 1 });
  const ts = 1_800_000_000;
  const sig = signBridgeBody(secret, ts, body);
  const ok = verifyBridgeSignature({ secret, timestampHeader: String(ts), signatureHeader: sig, rawBody: body, nowSeconds: ts + 10 });
  assert.deepEqual(ok, { ok: true });
  const tampered = verifyBridgeSignature({ secret, timestampHeader: String(ts), signatureHeader: sig, rawBody: body + " ", nowSeconds: ts });
  assert.deepEqual(tampered, { ok: false, reason: "invalid" });
  const expired = verifyBridgeSignature({ secret, timestampHeader: String(ts), signatureHeader: sig, rawBody: body, nowSeconds: ts + 301 });
  assert.deepEqual(expired, { ok: false, reason: "expired" });
  const missing = verifyBridgeSignature({ secret: undefined, timestampHeader: String(ts), signatureHeader: sig, rawBody: body, nowSeconds: ts });
  assert.deepEqual(missing, { ok: false, reason: "missing" });
  const wrongSecret = verifyBridgeSignature({ secret: "outro", timestampHeader: String(ts), signatureHeader: sig, rawBody: body, nowSeconds: ts });
  assert.deepEqual(wrongSecret, { ok: false, reason: "invalid" });
});

test("nomes: primeiro nome; inicial do sobrenome só com homônimo no mesmo horário", () => {
  const names = buildDisplayNames([
    { id: "a", fullName: "ANA CLARA SOUZA", scheduledStart: START },
    { id: "b", fullName: "Ana Beatriz Lima", scheduledStart: START },
    { id: "c", fullName: "Ana Paula Reis", scheduledStart: "2026-11-17T20:00:00Z" },
    { id: "d", fullName: "João Pedro Silva", scheduledStart: START },
  ]);
  assert.equal(names.get("a"), "Ana S.");
  assert.equal(names.get("b"), "Ana L.");
  assert.equal(names.get("c"), "Ana");
  assert.equal(names.get("d"), "João");
});

test("idade: anos, meses e antes do aniversário", () => {
  assert.equal(ageLabel("2020-11-18", "2026-11-17"), "5 anos");
  assert.equal(ageLabel("2020-11-17", "2026-11-17"), "6 anos");
  assert.equal(ageLabel("2025-03-10", "2026-11-17"), "1 ano e 8 meses");
  assert.equal(ageLabel("2026-05-10", "2026-11-17"), "6 meses");
  assert.equal(ageLabel("2027-01-01", "2026-11-17"), "");
});

test("snapshot: última entrada vale, item limpo e item nunca respondido ficam de fora", () => {
  const scores = buildSnapshotScores([
    { kind: "item", protocolItemId: "i1", score: 0, savedAt: "2026-11-17T18:00:00Z" },
    { kind: "item", protocolItemId: "i1", score: 2, savedAt: "2026-11-17T19:00:00Z" },
    { kind: "item", protocolItemId: "i2", score: 1, savedAt: "2026-11-17T18:00:00Z" },
    { kind: "item", protocolItemId: "i2", score: null, savedAt: "2026-11-17T18:30:00Z" },
    { kind: "evolution", protocolItemId: null, score: null, savedAt: "2026-11-17T18:30:00Z" },
  ]);
  assert.deepEqual(scores, { i1: 2 });
});

import { buildSupervisorQueue, computeOnTimeKpi, type QueueVisit } from "../lib/playground/queue.ts";

function qv(overrides: Partial<QueueVisit>): QueueVisit {
  return {
    id: "v1",
    seriesId: "s1",
    visitNo: 1,
    scheduledStart: START,
    durationMin: 60,
    arrivedAt: null,
    leftAt: null,
    cancelledAt: null,
    firstEntryAt: null,
    ...overrides,
  };
}
const SERIES = [{ id: "s1", status: "liberada" as const, patientName: "Ana Clara", locationName: "Parque" }];

test("fila: atrasada vem antes de conclusão pendente, que vem antes de não feita e faltou", () => {
  const now = at("2026-11-17T20:00:00Z");
  const items = buildSupervisorQueue({
    series: [
      ...SERIES,
      { id: "s2", status: "liberada", patientName: "Bia", locationName: "Parque" },
      { id: "s3", status: "liberada", patientName: "Caio", locationName: "Grão-Pará" },
    ],
    visits: [
      qv({ id: "a", seriesId: "s1", arrivedAt: "2026-11-17T17:35:00Z", leftAt: "2026-11-17T18:30:00Z" }), // atrasada
      qv({ id: "b", seriesId: "s2", scheduledStart: "2026-11-16T17:30:00Z" }), // faltou (ontem)
      qv({ id: "c", seriesId: "s3", scheduledStart: "2026-11-16T17:30:00Z", arrivedAt: "2026-11-16T17:40:00Z" }), // não feita
    ],
    now,
    timeZone: TZ,
  });
  const kinds = items.map((i) => `${i.kind}:${i.seriesId}`);
  assert.deepEqual(kinds, [
    "atrasada:s1",
    "conclusao_pendente:s2",
    "conclusao_pendente:s3",
    "nao_feita:s3",
    "faltou:s2",
  ]);
});

test("fila: rascunho entra para liberar; concluída e visita antiga ficam de fora", () => {
  const now = at("2026-11-17T20:00:00Z");
  const items = buildSupervisorQueue({
    series: [
      { id: "r", status: "rascunho", patientName: "Rafa", locationName: "Parque" },
      { id: "c", status: "concluida", patientName: "Cris", locationName: "Parque" },
      { id: "o", status: "liberada", patientName: "Otto", locationName: "Parque" },
    ],
    visits: [
      qv({ id: "x", seriesId: "c", scheduledStart: "2026-11-16T17:30:00Z" }),
      qv({ id: "y", seriesId: "o", scheduledStart: "2026-10-01T17:30:00Z" }), // fora da janela de 14 dias
      qv({ id: "z", seriesId: "o", visitNo: 2, scheduledStart: "2026-11-20T17:30:00Z" }), // futura
    ],
    now,
    timeZone: TZ,
  });
  assert.deepEqual(items.map((i) => i.kind), ["rascunho"]);
});

test("kpi: feitas no prazo com comparativo do mês anterior", () => {
  const rows = [
    ...Array.from({ length: 9 }, () => ({ month: "2026-11-01", onTime: true })),
    { month: "2026-11-01", onTime: false },
    ...Array.from({ length: 17 }, () => ({ month: "2026-10-01", onTime: true })),
    ...Array.from({ length: 3 }, () => ({ month: "2026-10-01", onTime: false })),
  ];
  const kpi = computeOnTimeKpi(rows, at("2026-11-17T12:00:00Z"), TZ);
  assert.deepEqual(kpi.current, { onTime: 9, total: 10, pct: 90 });
  assert.deepEqual(kpi.previous, { onTime: 17, total: 20, pct: 85 });
  assert.equal(kpi.deltaPp, 5);
  const noPrev = computeOnTimeKpi(rows.filter((r) => r.month === "2026-11-01"), at("2026-11-17T12:00:00Z"), TZ);
  assert.equal(noPrev.deltaPp, null);
});

import { generateKeyPairSync, publicEncrypt, randomBytes, createCipheriv, constants as cryptoConstants } from "node:crypto";
import { decryptSealed } from "../lib/playground/sealed.ts";

// Cifra do mesmo jeito que o PDV (RSA-OAEP-SHA256 + AES-256-GCM, ct||tag).
function seal(publicKeyPem: string, payload: unknown): string {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final(), cipher.getAuthTag()]);
  const wrapped = publicEncrypt({ key: publicKeyPem, padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
  const enc = (b: Buffer) => b.toString("base64url");
  return `v1.${enc(wrapped)}.${enc(iv)}.${enc(ct)}`;
}

test("envelope cifrado: só a chave privada da clínica abre; adulterado ou outra chave falha", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const otherPem = other.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const payload = { action: "entries", body: { visitId: "v1", entries: [{ idempotencyKey: "k1" }] } };

  const envelope = seal(publicPem, payload);
  assert.deepEqual(decryptSealed(privatePem, envelope), payload);
  // PEM com "\n" literal (como costuma vir em variável de ambiente).
  assert.deepEqual(decryptSealed(privatePem.replace(/\n/g, "\\n"), envelope), payload);
  // DER PKCS8 em base64.
  const der = pair.privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  assert.deepEqual(decryptSealed(der, envelope), payload);

  assert.equal(decryptSealed(otherPem, envelope), null);
  assert.equal(decryptSealed(undefined, envelope), null);
  assert.equal(decryptSealed(privatePem, envelope.slice(0, -4) + "AAAA"), null);
  assert.equal(decryptSealed(privatePem, "lixo"), null);
  assert.equal(decryptSealed(privatePem, seal(publicPem, { action: "apagar_tudo", body: {} })), null);
});
