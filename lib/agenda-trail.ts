// lib/agenda-trail.ts
/**
 * "Rastro do dia": trilha derivada dos timestamps de cada sessão. Cada linha
 * cita o horário da sessão — o mesmo paciente pode ter duas sessões no dia
 * (uma ativa e outra cancelada) e, sem o horário, o Rastro parecia contradizer
 * a lista da agenda.
 */
export type TrailAppointment = {
  patientName: string;
  status: string;
  startsAt: string;
  confirmedAt: string | null;
  checkinAt: string | null;
  checkoutAt: string | null;
  cancelledAt: string | null;
};

export type TrailEvent = { at: string; msg: string };

function hhmm(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
}

export function buildTrailEvents(
  appointments: readonly TrailAppointment[],
  statusLabel: (status: string) => string,
  timeZone: string,
): TrailEvent[] {
  const events: TrailEvent[] = [];
  for (const a of appointments) {
    const session = `sessão das ${hhmm(a.startsAt, timeZone)}`;
    if (a.confirmedAt) events.push({ at: a.confirmedAt, msg: `${a.patientName} confirmou presença (${session})` });
    if (a.checkinAt) events.push({ at: a.checkinAt, msg: `Check-in de ${a.patientName} (${session})` });
    if (a.checkoutAt) events.push({ at: a.checkoutAt, msg: `Sessão de ${a.patientName} concluída (${session})` });
    if (a.cancelledAt) events.push({ at: a.cancelledAt, msg: `${a.patientName} — ${statusLabel(a.status)} (${session})` });
  }
  return events.sort((x, y) => y.at.localeCompare(x.at));
}
