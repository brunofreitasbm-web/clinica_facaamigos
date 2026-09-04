// lib/session-note-fields.ts
/**
 * Campos estruturados da evolução clínica mínima — PRD §9.4, sem a parte
 * de metas trabalhadas (depende de plan_goals, Fase 2). Lista de
 * comportamentos é fixa nesta entrega — configuração pelo supervisor
 * (mencionada no §9.4 como "lista configurável") ainda não existe.
 */
export const BEHAVIOR_TYPES = [
  { value: "agitacao", label: "Agitação" },
  { value: "estereotipia", label: "Estereotipia" },
  { value: "birra_crise", label: "Birra/crise" },
  { value: "autolesao", label: "Autolesão" },
  { value: "agressividade", label: "Agressividade" },
  { value: "choro", label: "Choro" },
  { value: "recusa_atividade", label: "Recusa de atividade" },
  { value: "outro", label: "Outro" },
] as const;

export const BEHAVIOR_INTENSITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "intensa", label: "Intensa" },
] as const;

/** Chips de orientação à família — lista literal do §9.4. */
export const FAMILY_GUIDANCE_OPTIONS = [
  { value: "rotina", label: "Rotina" },
  { value: "comunicacao", label: "Comunicação" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "sono", label: "Sono" },
  { value: "escola", label: "Escola" },
  { value: "nenhuma", label: "Nenhuma" },
] as const;

/** Formato gravado em session_notes.structured (jsonb). */
export type SessionNoteStructured = {
  presenca_engajamento: number;
  comportamentos: { tipo: string; intensidade: string }[];
  orientacoes: string[];
};
