// Lista do dia da 1ª avaliação (acrílico da porta da sala de avaliação).
// Parte pura — sem I/O — para ser testável com `node --test`.

export type DoorListRow = {
  time: string;
  patient: string;
  guardian: string;
  therapist: string;
};

/**
 * O acrílico fica numa porta voltada para o corredor: qualquer pessoa lê o que
 * está impresso. Nome completo de criança em atendimento terapêutico é dado de
 * saúde (LGPD), então a lista mostra uma forma reduzida.
 */
const PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

export function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  // Partículas ("da", "de"...) não contam como sobrenome: "Ana de Souza" → "Ana S."
  const surnames = parts.slice(1).filter((p) => !PARTICLES.has(p.toLowerCase()));
  const last = surnames[surnames.length - 1];
  if (!last) return parts[0];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

/** Ordena por horário e aplica a abreviação de nomes. */
export function buildDoorListRows(
  items: { time: string; patient: string; guardian: string | null; therapist: string }[],
): DoorListRow[] {
  return [...items]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((i) => ({
      time: i.time,
      patient: abbreviateName(i.patient),
      guardian: i.guardian ? abbreviateName(i.guardian) : "—",
      therapist: i.therapist,
    }));
}
