// lib/appointment-ui-state.ts
/**
 * Estado de UI derivado de status + checkin_at + attendance_started_at +
 * checkout_at — não são novos valores de `appointments.status` no banco
 * (ver design doc). checkin_at = recepção registrou chegada (Na Recepção);
 * attendance_started_at = terapeuta iniciou o atendimento (Em Atendimento).
 */
export type AppointmentUiState =
  | "aguardando"
  | "na_recepcao"
  | "em_atendimento"
  | "realizada"
  | "terminal_negativo";

export const UI_STATE_LABEL: Record<AppointmentUiState, string> = {
  aguardando: "Aguardando",
  na_recepcao: "Na recepção",
  em_atendimento: "Em atendimento",
  realizada: "Realizada",
  terminal_negativo: "Encerrada",
};

export function computeAppointmentUiState(appointment: {
  status: string;
  checkinAt: string | null;
  attendanceStartedAt?: string | null;
  checkoutAt: string | null;
}): AppointmentUiState {
  if (appointment.status === "realizada") return "realizada";
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return "terminal_negativo";
  }
  if (appointment.checkinAt && !appointment.checkoutAt) {
    return appointment.attendanceStartedAt ? "em_atendimento" : "na_recepcao";
  }
  return "aguardando";
}
