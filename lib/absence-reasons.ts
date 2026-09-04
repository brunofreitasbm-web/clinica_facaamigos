// lib/absence-reasons.ts
/**
 * Categorias fixas de `absence_reports.reason_category` (CHECK constraint,
 * PRD §5) — compartilhada entre o formulário da família e as telas de
 * leitura (recepção), pra nunca divergir entre as duas pontas. Note que é
 * uma lista DIFERENTE de CANCEL_REASONS (lib/appointment-cancel-reasons.ts):
 * aquela é o vocabulário da recepção pra cancelar/marcar falta na agenda;
 * esta é o vocabulário simplificado que a família vê no portal.
 */
export const ABSENCE_REASON_CATEGORIES = [
  { value: "doenca", label: "Doença" },
  { value: "viagem", label: "Viagem" },
  { value: "compromisso", label: "Compromisso" },
  { value: "outro", label: "Outro" },
] as const;

export type AbsenceReasonCategory = (typeof ABSENCE_REASON_CATEGORIES)[number]["value"];

export const ABSENCE_REASON_LABEL: Record<string, string> = Object.fromEntries(
  ABSENCE_REASON_CATEGORIES.map((c) => [c.value, c.label]),
);
