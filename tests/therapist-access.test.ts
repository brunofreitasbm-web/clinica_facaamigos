// tests/therapist-access.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

type PatientAccessRuleInput = {
  hasPatientAccessRow: boolean;
  hasAgendaAppointment: boolean;
  hasAttendedSessionNote: boolean;
};

/**
 * Função utilitária que simula a avaliação da regra de acesso do terapeuta
 * ao prontuário unificado do paciente.
 *
 * Um terapeuta tem acesso se:
 * - Tiver um registro em patient_access (vínculo ativo);
 * - OU tiver um agendamento atribuído na agenda (appointments.therapist_id);
 * - OU tiver realizado/registrado atendimento (session_notes).
 */
export function hasTherapistChartAccess(input: PatientAccessRuleInput): boolean {
  return (
    input.hasPatientAccessRow ||
    input.hasAgendaAppointment ||
    input.hasAttendedSessionNote
  );
}

test("Permite acesso ao prontuário quando o terapeuta tem vínculo em patient_access", () => {
  assert.equal(
    hasTherapistChartAccess({
      hasPatientAccessRow: true,
      hasAgendaAppointment: false,
      hasAttendedSessionNote: false,
    }),
    true
  );
});

test("Permite acesso ao prontuário quando o terapeuta está atribuído na agenda", () => {
  assert.equal(
    hasTherapistChartAccess({
      hasPatientAccessRow: false,
      hasAgendaAppointment: true,
      hasAttendedSessionNote: false,
    }),
    true
  );
});

test("Permite acesso ao prontuário quando o terapeuta já atendeu o paciente previamente", () => {
  assert.equal(
    hasTherapistChartAccess({
      hasPatientAccessRow: false,
      hasAgendaAppointment: false,
      hasAttendedSessionNote: true,
    }),
    true
  );
});

test("Bloqueia acesso ao prontuário se o terapeuta não tem vínculo, agendamento nem atendimento prévio", () => {
  assert.equal(
    hasTherapistChartAccess({
      hasPatientAccessRow: false,
      hasAgendaAppointment: false,
      hasAttendedSessionNote: false,
    }),
    false
  );
});
