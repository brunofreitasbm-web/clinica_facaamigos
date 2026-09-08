// tests/checkin-match.test.ts
//
// Casos-limite do check-in por QR (lib/checkin-match.ts): gêmeos com a mesma
// data de nascimento, paciente com duas sessões no mesmo dia, apelido/nome
// divergente, chegada fora da janela (muito adiantada) e sessão cancelada.
// Ver "Análise de falhas" no plano de implementação para o porquê de cada
// contorno — estes testes travam esse comportamento.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchCheckinRequest, type CheckinCandidateAppointment } from "../lib/checkin-match.ts";

const NOW = "2026-09-08T13:00:00.000Z";

function appt(overrides: Partial<CheckinCandidateAppointment>): CheckinCandidateAppointment {
  return {
    appointmentId: "apt-1",
    patientId: "pat-1",
    patientFullName: "João Pedro Silva",
    birthDate: "2018-03-10",
    startsAt: NOW,
    status: "agendada",
    ...overrides,
  };
}

test("match exato: um paciente, uma sessão, nome e data de nascimento batem", () => {
  const result = matchCheckinRequest(
    [appt({})],
    { firstName: "João", birthDate: "2018-03-10" },
    NOW,
  );
  assert.equal(result.quality, "exato");
  assert.equal(result.kind, "agendado");
  assert.equal(result.appointmentId, "apt-1");
  assert.equal(result.patientId, "pat-1");
});

test("paciente não encontrado (data de nascimento não bate com ninguém) -> visitante", () => {
  const result = matchCheckinRequest(
    [appt({})],
    { firstName: "João", birthDate: "1999-01-01" },
    NOW,
  );
  assert.equal(result.quality, "nenhum");
  assert.equal(result.kind, "sem_agendamento");
  assert.equal(result.patientId, null);
  assert.equal(result.appointmentId, null);
});

test("gêmeos: mesma data de nascimento e mesmo primeiro nome batido -> ambíguo, nunca escolhe", () => {
  const joao = appt({ appointmentId: "apt-joao", patientId: "pat-joao", patientFullName: "João Pedro Silva" });
  const joaoIrmao = appt({ appointmentId: "apt-joao-2", patientId: "pat-joao-2", patientFullName: "João Miguel Silva" });

  const result = matchCheckinRequest([joao, joaoIrmao], { firstName: "João", birthDate: "2018-03-10" }, NOW);

  assert.equal(result.quality, "ambiguo");
  assert.equal(result.appointmentId, null);
  assert.equal(result.patientId, null);
  assert.deepEqual(new Set(result.candidateAppointmentIds), new Set(["apt-joao", "apt-joao-2"]));
});

test("irmãos com data de nascimento igual mas nomes diferentes -> ambíguo sem o nome resolver", () => {
  const maria = appt({ appointmentId: "apt-maria", patientId: "pat-maria", patientFullName: "Maria Silva" });
  const joao = appt({ appointmentId: "apt-joao", patientId: "pat-joao", patientFullName: "João Silva" });

  // Digitou um nome que não bate com nenhum dos dois -> não dá para escolher.
  const result = matchCheckinRequest([maria, joao], { firstName: "Ana", birthDate: "2018-03-10" }, NOW);

  assert.equal(result.quality, "ambiguo");
  assert.equal(result.appointmentId, null);
  assert.deepEqual(new Set(result.candidateAppointmentIds), new Set(["apt-maria", "apt-joao"]));
});

test("data de nascimento aponta para 1 único paciente mas o nome não bate -> nome_divergente, vincula mesmo assim", () => {
  const result = matchCheckinRequest(
    [appt({ patientFullName: "Beatriz Costa" })],
    { firstName: "Bia", birthDate: "2018-03-10" }, // apelido não é prefixo de "Beatriz"
    NOW,
  );
  assert.equal(result.quality, "nome_divergente");
  assert.equal(result.appointmentId, "apt-1");
  assert.equal(result.patientId, "pat-1");
});

test("apelido como prefixo do nome ('Bia' de 'Biatriz') -> exato", () => {
  const result = matchCheckinRequest(
    [appt({ patientFullName: "Biatriz Costa" })],
    { firstName: "Bia", birthDate: "2018-03-10" },
    NOW,
  );
  assert.equal(result.quality, "exato");
});

test("nome com acento casa com nome digitado sem acento", () => {
  const result = matchCheckinRequest(
    [appt({ patientFullName: "João Antônio" })],
    { firstName: "joao", birthDate: "2018-03-10" },
    NOW,
  );
  assert.equal(result.quality, "exato");
});

test("paciente com duas sessões no mesmo dia: só uma dentro da janela de chegada -> exato nessa", () => {
  const manha = appt({ appointmentId: "apt-manha", startsAt: "2026-09-08T13:00:00.000Z" }); // = NOW
  const tarde = appt({ appointmentId: "apt-tarde", startsAt: "2026-09-08T17:00:00.000Z" }); // 4h depois

  const result = matchCheckinRequest([manha, tarde], { firstName: "João", birthDate: "2018-03-10" }, NOW);

  assert.equal(result.quality, "exato");
  assert.equal(result.appointmentId, "apt-manha");
});

test("paciente com duas sessões coladas, ambas dentro da janela -> ambíguo, recepção escolhe", () => {
  const s1 = appt({ appointmentId: "apt-1a", startsAt: "2026-09-08T13:10:00.000Z" }); // 10min depois de NOW
  const s2 = appt({ appointmentId: "apt-1b", startsAt: "2026-09-08T13:20:00.000Z" }); // 20min depois de NOW

  const result = matchCheckinRequest([s1, s2], { firstName: "João", birthDate: "2018-03-10" }, NOW);

  assert.equal(result.quality, "ambiguo");
  assert.equal(result.appointmentId, null);
  assert.deepEqual(new Set(result.candidateAppointmentIds), new Set(["apt-1a", "apt-1b"]));
});

test("chegada muito adiantada (2h antes) -> fora_da_janela, mas ainda vincula à sessão mais próxima", () => {
  const result = matchCheckinRequest(
    [appt({ appointmentId: "apt-tarde", startsAt: "2026-09-08T15:00:00.000Z" })], // 2h depois de NOW
    { firstName: "João", birthDate: "2018-03-10" },
    NOW,
  );
  assert.equal(result.quality, "fora_da_janela");
  assert.equal(result.appointmentId, "apt-tarde");
});

test("chegada dentro de 90 min antes do início conta como dentro da janela", () => {
  const result = matchCheckinRequest(
    [appt({ appointmentId: "apt-1", startsAt: "2026-09-08T14:29:00.000Z" })], // 89min depois de NOW
    { firstName: "João", birthDate: "2018-03-10" },
    NOW,
  );
  assert.equal(result.quality, "exato");
});

test("sessão cancelada do dia ainda é candidata ao match (a família pode não ter sido avisada)", () => {
  const result = matchCheckinRequest(
    [appt({ status: "cancelada_terapeuta" })],
    { firstName: "João", birthDate: "2018-03-10" },
    NOW,
  );
  assert.equal(result.quality, "exato");
  assert.equal(result.appointmentId, "apt-1");
});
