// lib/patient-journey-pure.ts
//
// Status real do paciente no quadro "Próximo passo" do prontuário. Lógica pura
// (sem imports "@/") para ser testável com node:test (tests/patient-journey.test.ts).
//
// Ordem da jornada: plano autorizado → avaliação agendada → avaliação realizada
// → guia registrada → grade montada. O plano autorizado vem ANTES da avaliação
// (promoteToPatient: plano autorizado = apto à 1ª avaliação).

/**
 * Status de appointment que representam uma sessão que não vai acontecer
 * (cancelada ou remarcada) — nunca devem contar como "agendada"/"realizada"
 * pra fins de progresso do paciente.
 */
export const CANCELLED_APPOINTMENT_STATUSES = [
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
  "falta_familia",
  "remarcada",
] as const;

export type JourneyKey =
  | "aguardando_envio_guia"
  | "aguardando_autorizacao"
  | "agendar_avaliacao"
  | "avaliacao_agendada"
  | "registrar_guia"
  | "montar_grade"
  | "ativo";

export type JourneyStep = 1 | 2 | 3 | 4 | 5;

export const JOURNEY_STEPS: readonly { n: JourneyStep; label: string }[] = [
  { n: 1, label: "Plano autorizado" },
  { n: 2, label: "Avaliação agendada" },
  { n: 3, label: "Avaliação realizada" },
  { n: 4, label: "Guia registrada" },
  { n: 5, label: "Grade terapêutica montada" },
];

export type JourneyEvaluation = { starts_at: string; status: string };

export type JourneyInput = {
  patient: { status: string; evaluated_at: string | null; first_session_at: string | null };
  /** Rascunho da esteira com plano autorizado, dispensado (particular) ou agendamento habilitado. */
  planAuthorizedByDraft: boolean;
  /** Guia enviada ao plano em algum rascunho da esteira. */
  guideSent: boolean;
  /** Particular: sem guia a registrar. */
  authorizationWaived: boolean;
  hasActiveAuthorization: boolean;
  /** Todas as avaliações (`is_evaluation`) do paciente, de qualquer status. */
  evaluations: JourneyEvaluation[];
  /** Formata data/hora ISO para exibição; padrão pt-BR no fuso da clínica. */
  formatDateTime?: (iso: string) => string;
};

export type Journey = {
  key: JourneyKey;
  /** Etapa corrente (1–5). Etapas anteriores estão concluídas. */
  step: JourneyStep;
  /** Frase curta com o status real, ex.: "Autorizado — aguardando agendar a 1ª avaliação". */
  label: string;
  /** Complemento (data da avaliação, motivo de reagendar…); null se não houver. */
  detail: string | null;
  /** Texto do botão do link; null quando não há ação (ativo). */
  ctaLabel: string | null;
};

const defaultFormat = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const isCancelled = (status: string) => (CANCELLED_APPOINTMENT_STATUSES as readonly string[]).includes(status);

const CANCEL_REASON: Record<string, string> = {
  cancelada_clinica: "cancelada pela clínica",
  cancelada_familia: "cancelada pela família",
  cancelada_terapeuta: "cancelada pelo terapeuta",
  falta_familia: "família faltou",
  remarcada: "remarcada",
};

export function computeJourney(input: JourneyInput): Journey {
  const fmt = input.formatDateTime ?? defaultFormat;
  const { patient } = input;

  if (patient.status === "ativo" || patient.first_session_at) {
    return { key: "ativo", step: 5, label: "Ativo — grade terapêutica montada", detail: null, ctaLabel: null };
  }

  // Quem tem prontuário já foi promovido (promoteToPatient) — plano autorizado.
  const authorized =
    input.planAuthorizedByDraft || input.hasActiveAuthorization || !["interessado", "aguardando"].includes(patient.status);

  if (!authorized) {
    return input.guideSent
      ? {
          key: "aguardando_autorizacao",
          step: 1,
          label: "Guia enviada — aguardando o plano autorizar",
          detail: null,
          ctaLabel: "Registrar autorização",
        }
      : {
          key: "aguardando_envio_guia",
          step: 1,
          label: "Aguardando envio da guia ao plano",
          detail: null,
          ctaLabel: "Abrir pendências",
        };
  }

  const live = input.evaluations.filter((e) => !isCancelled(e.status));
  const done = Boolean(patient.evaluated_at) || live.some((e) => e.status === "realizada");
  const scheduled = live
    .filter((e) => e.status !== "realizada")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  if (!done && !scheduled) {
    const lastCancelled = input.evaluations
      .filter((e) => isCancelled(e.status))
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
    return {
      key: "agendar_avaliacao",
      step: 2,
      label: "Autorizado — aguardando agendar a 1ª avaliação",
      detail: lastCancelled
        ? `A avaliação de ${fmt(lastCancelled.starts_at)} foi ${CANCEL_REASON[lastCancelled.status] ?? "cancelada"}.`
        : null,
      ctaLabel: "Agendar avaliação",
    };
  }

  if (!done && scheduled) {
    return {
      key: "avaliacao_agendada",
      step: 3,
      label: "Autorizado — aguardando a 1ª avaliação",
      detail: `Avaliação marcada para ${fmt(scheduled.starts_at)}.`,
      ctaLabel: "Ver agenda de avaliações",
    };
  }

  if (!input.hasActiveAuthorization && !input.authorizationWaived) {
    return {
      key: "registrar_guia",
      step: 4,
      label: "Avaliação realizada — falta registrar a guia",
      detail: null,
      ctaLabel: "Registrar autorização",
    };
  }

  return {
    key: "montar_grade",
    step: 5,
    label: "Avaliação realizada — aguardando montar a grade",
    detail: null,
    ctaLabel: "Montar grade (1ª sessão)",
  };
}
