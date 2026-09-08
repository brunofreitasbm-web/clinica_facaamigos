// lib/pts-slots.ts
// Utilitário de fatiamento de disponibilidade do paciente em sessões de 40 minutos

export type ShiftType = "MANHA" | "TARDE" | "NOITE";

/**
 * Converte um turno (Manhã: 08-12h, Tarde: 13-17h, Noite: 17-21h)
 * em um conjunto de períodos/slots discretos de 40 minutos.
 */
export function generate40MinSlotsForShift(shift: ShiftType): string[] {
  let startHour = 8;
  let endHour = 12;
  if (shift === "TARDE") {
    startHour = 13;
    endHour = 17;
  } else if (shift === "NOITE") {
    startHour = 17;
    endHour = 21;
  }

  const slots: string[] = [];
  let currentMin = startHour * 60;
  const endMin = endHour * 60;

  while (currentMin + 40 <= endMin) {
    const sH = String(Math.floor(currentMin / 60)).padStart(2, "0");
    const sM = String(currentMin % 60).padStart(2, "0");
    const eMin = currentMin + 40;
    const eH = String(Math.floor(eMin / 60)).padStart(2, "0");
    const eM = String(eMin % 60).padStart(2, "0");
    slots.push(`${sH}:${sM} - ${eH}:${eM}`);
    currentMin += 40;
  }
  return slots;
}
