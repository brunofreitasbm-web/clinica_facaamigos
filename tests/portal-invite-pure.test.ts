import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickInviteCandidates,
  nextGapSeconds,
  underDailyCap,
  shouldPause,
  generateInviteToken,
  isStopMessage,
  toE164Digits,
  type InvitePatient,
} from "../lib/portal-invite-pure.ts";

const g = (id: string, phone: string | null, extra: Partial<{ portal_first_login_at: string | null; is_financial: boolean }> = {}) => ({
  id,
  full_name: "Maria Souza",
  phone,
  is_financial: extra.is_financial ?? true,
  portal_first_login_at: extra.portal_first_login_at ?? null,
});
const patient = (id: string, over: Partial<InvitePatient> = {}): InvitePatient => ({
  id,
  full_name: "Davi Átila",
  evaluated_at: "2026-11-10T12:00:00Z",
  evaluationStatuses: [],
  guardians: [g(`g-${id}`, "(91) 99999-8888")],
  ...over,
});
const none = new Set<string>();
const pick = (patients: InvitePatient[], extra: { invited?: Set<string>; opt?: Set<string> } = {}) =>
  pickInviteCandidates({ patients, invitedPhones: extra.invited ?? none, optedOutPhones: extra.opt ?? none, rng: () => 0.5 });

test("telefone BR vira dígitos com DDI; lixo vira vazio", () => {
  assert.equal(toE164Digits("(91) 99999-8888"), "5591999998888");
  assert.equal(toE164Digits("+55 91 99999-8888"), "5591999998888");
  assert.equal(toE164Digits("123"), "");
  assert.equal(toE164Digits(null), "");
});

test("só anamnese REALIZADA entra; agendada ou sem avaliação não", () => {
  assert.equal(pick([patient("a")]).length, 1);
  assert.equal(pick([patient("a", { evaluated_at: null, evaluationStatuses: ["realizada"] })]).length, 1);
  assert.equal(pick([patient("a", { evaluated_at: null, evaluationStatuses: ["agendada", "confirmada"] })]).length, 0);
  assert.equal(pick([patient("a", { evaluated_at: null })]).length, 0);
});

test("já acessou o Portal, já convidado ou pediu PARAR: fora", () => {
  const logged = patient("a", { guardians: [g("g1", "91999998888", { portal_first_login_at: "2026-11-11T00:00:00Z" })] });
  assert.equal(pick([logged]).length, 0);
  assert.equal(pick([patient("a")], { invited: new Set(["5591999998888"]) }).length, 0);
  assert.equal(pick([patient("a")], { opt: new Set(["5591999998888"]) }).length, 0);
});

test("irmãos com o mesmo telefone geram 1 convite só", () => {
  const out = pick([patient("a"), patient("b"), patient("c", { guardians: [g("g3", "91988887777")] })]);
  assert.equal(out.length, 2);
  assert.deepEqual(new Set(out.map((c) => c.phone)), new Set(["5591999998888", "5591988887777"]));
});

test("sem telefone válido: fora; nome da criança vira primeiro nome", () => {
  assert.equal(pick([patient("a", { guardians: [g("g1", null)] })]).length, 0);
  assert.equal(pick([patient("a", { guardians: [g("g1", "12")] })]).length, 0);
  assert.equal(pick([patient("a")])[0].childName, "Davi");
});

test("ordem aleatória depende do rng (embaralha), mas mantém o mesmo conjunto", () => {
  const ps = ["a", "b", "c", "d"].map((id, i) => patient(id, { guardians: [g(`g${id}`, `9199999000${i}`)] }));
  const a = pickInviteCandidates({ patients: ps, invitedPhones: none, optedOutPhones: none, rng: () => 0 });
  const b = pickInviteCandidates({ patients: ps, invitedPhones: none, optedOutPhones: none, rng: () => 0.99 });
  assert.equal(a.length, 4);
  assert.deepEqual(new Set(a.map((c) => c.patientId)), new Set(b.map((c) => c.patientId)));
  assert.notDeepEqual(a.map((c) => c.patientId), b.map((c) => c.patientId));
});

test("intervalo aleatório fica entre min e max (inclusive)", () => {
  assert.equal(nextGapSeconds(120, 420, () => 0), 120);
  assert.equal(nextGapSeconds(120, 420, () => 0.999999), 420);
  for (let i = 0; i < 500; i++) {
    const s = nextGapSeconds(120, 420);
    assert.ok(s >= 120 && s <= 420);
  }
  assert.equal(nextGapSeconds(420, 120, () => 0), 120); // min/max invertidos
});

test("teto diário", () => {
  assert.equal(underDailyCap(29, 30), true);
  assert.equal(underDailyCap(30, 30), false);
});

test("pausa: 3 falhas seguidas ou código de qualidade na última tentativa", () => {
  assert.equal(shouldPause([]), null);
  assert.equal(shouldPause([{ ok: false }, { ok: false }]), null);
  assert.equal(shouldPause([{ ok: false }, { ok: false }, { ok: false }]), "3 falhas seguidas");
  assert.equal(shouldPause([{ ok: false }, { ok: true }, { ok: false }]), null);
  assert.match(shouldPause([{ ok: false, errorCode: 63018 }, { ok: true }]) ?? "", /qualidade/);
  assert.equal(shouldPause([{ ok: true, errorCode: 63018 }]), null);
});

test("token tem 16 caracteres sem ambiguidade", () => {
  const t = generateInviteToken();
  assert.match(t, /^[a-hj-km-zA-HJ-NP-Z2-9]{16}$/);
});

test("PARAR é reconhecido sem confundir com frases", () => {
  for (const w of ["PARAR", "parar.", " Sair ", "stop!", "Descadastrar"]) assert.equal(isStopMessage(w), true, w);
  for (const w of ["não quero parar", "oi", "", null]) assert.equal(isStopMessage(w as string | null), false);
});
