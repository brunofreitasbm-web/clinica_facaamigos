// lib/appointment-ui-state.ts
/**
 * Estado de UI derivado de status + checkin_at + checkout_at — não é um
 * novo valor de `appointments.status` no banco (ver design doc).
 */
export type AppointmentUiState =
  | "aguardando"
  | "em_atendimento"
  | "realizada"
  | "terminal_negativo";

export function computeAppointmentUiState(appointment: {
  status: string;
  checkinAt: string | null;
  checkoutAt: string | null;
}): AppointmentUiState {
  if (appointment.status === "realizada") return "realizada";
  if (appointment.status !== "agendada" && appointment.status !== "confirmada") {
    return "terminal_negativo";
  }
  if (appointment.checkinAt && !appointment.checkoutAt) return "em_atendimento";
  return "aguardando";
}
