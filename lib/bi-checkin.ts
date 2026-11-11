// lib/bi-checkin.ts
// Regra única do BI (decisão do dono, 2026-11-11): só é PACIENTE quem fez
// check-in na recepção (appointments.checkin_at preenchido). Quem tem cadastro,
// agendamento ou guia mas nunca deu check-in é LEAD. Toda métrica de "pacientes"
// do painel de Inteligência deriva do índice abaixo, para os quadros não
// divergirem entre si.
//
// Módulo puro (sem imports) para ser testável com `node --test`.

export type BiAppointmentRow = {
  patient_id: string | null;
  status: string;
  checkin_at: string | null;
};

export type PatientCheckinIndex = {
  /** Pacientes com ao menos um check-in (histórico inteiro, não só o período). */
  checkedInIds: Set<string>;
  /** Instante (ISO) do primeiro check-in de cada paciente. */
  firstCheckinAt: Map<string, string>;
  /** Pessoas com agendamento válido (não cancelado/remarcado), com ou sem check-in. */
  scheduledIds: Set<string>;
};

export function buildPatientCheckinIndex(
  appointments: readonly BiAppointmentRow[],
  excludedStatuses: readonly string[],
): PatientCheckinIndex {
  const checkedInIds = new Set<string>();
  const firstCheckinAt = new Map<string, string>();
  const scheduledIds = new Set<string>();

  for (const a of appointments) {
    if (!a.patient_id) continue;
    if (a.checkin_at) {
      checkedInIds.add(a.patient_id);
      const current = firstCheckinAt.get(a.patient_id);
      if (!current || new Date(a.checkin_at).getTime() < new Date(current).getTime()) {
        firstCheckinAt.set(a.patient_id, a.checkin_at);
      }
    }
    if (!excludedStatuses.includes(a.status)) scheduledIds.add(a.patient_id);
  }

  return { checkedInIds, firstCheckinAt, scheduledIds };
}

/** Status que tiram o paciente da base ativa (continuam sendo pacientes, mas não "em acompanhamento"). */
export const BI_INACTIVE_PATIENT_STATUSES = ["alta", "evadido", "inativo", "desligado"] as const;

/** Subconjunto dos status acima que conta como evasão. */
export const BI_EVADED_PATIENT_STATUSES = ["inativo", "evadido", "desligado"] as const;

/** Chave para detectar cadastro duplicado da mesma criança (nome + nascimento). */
export function patientDedupeKey(fullName: string, birthDate: string | null): string {
  const name = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `${name}|${birthDate ?? ""}`;
}

export function isInPeriod(iso: string | null | undefined, startISO: string, endISO: string): boolean {
  return !!iso && iso >= startISO && iso < endISO;
}
