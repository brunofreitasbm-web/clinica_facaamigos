// lib/session-note-fields.ts
/**
 * Campos estruturados da evolução clínica — PRD §9.4. A lista de
 * comportamentos era fixa aqui; agora é configurável pelo supervisor
 * (behavior_catalog, supabase/migrations/20260907170001_behavior_catalog.sql
 * + lib/behavior-catalog.ts). Os valores abaixo (LEGACY_BEHAVIOR_TYPES)
 * ficam só como fallback de rótulo para evoluções assinadas antes da
 * migração para o catálogo.
 */
export const LEGACY_BEHAVIOR_TYPES = [
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

export const FAMILY_GUIDANCE_LABEL: Record<string, string> = Object.fromEntries(
  FAMILY_GUIDANCE_OPTIONS.map((g) => [g.value, g.label]),
);

/**
 * PRD §9.4 — "Resultado por meta" em 4 níveis, um dos dois eixos que
 * faltavam no formulário mínimo entregue em 20260904 (o outro é a própria
 * seleção de metas). Persistido dentro de cada item de `metas_trabalhadas`.
 */
export const GOAL_RESULT_LEVELS = [
  { value: "nao_iniciou", label: "Não iniciou" },
  { value: "em_aquisicao", label: "Em aquisição" },
  { value: "atingiu_com_ajuda", label: "Atingiu com ajuda" },
  { value: "independente", label: "Independente" },
] as const;

export type GoalResultLevel = (typeof GOAL_RESULT_LEVELS)[number]["value"];

export const GOAL_RESULT_LABEL: Record<string, string> = Object.fromEntries(
  GOAL_RESULT_LEVELS.map((r) => [r.value, r.label]),
);

export type MetaTrabalhada = { plan_goal_id: string; resultado: GoalResultLevel };

/**
 * CONTRATO DE APLICAÇÃO (PRD §7.1): esta chave é lida por
 * close_monthly_metric_snapshots() (supabase/migrations/
 * 20260907170004_data_collection_rate_metas.sql) para calcular
 * data_collection_rate (PRD §10.3). Renomear a chave aqui sem renomear o
 * literal equivalente no SQL quebra a métrica EM SILÊNCIO — nenhuma query
 * falha, ela só some. Coberto por tests/session-note-contract.test.ts.
 */
export const SESSION_NOTE_METAS_KEY = "metas_trabalhadas" as const;

/** Formato gravado em session_notes.structured (jsonb). */
export type SessionNoteStructured = {
  presenca_engajamento: number;
  [SESSION_NOTE_METAS_KEY]: MetaTrabalhada[];
  comportamentos: { tipo: string; intensidade: string }[];
  orientacoes: string[];
};

/**
 * Lê `structured.metas_trabalhadas` com segurança: session_notes é
 * append-only (nenhuma policy de UPDATE), então uma evolução assinada antes
 * desta chave existir nunca vai ganhá-la — todo leitor precisa tratar
 * ausência, nunca assumir presença.
 */
export function getMetasTrabalhadas(
  structured: SessionNoteStructured | Partial<SessionNoteStructured> | null | undefined,
): MetaTrabalhada[] {
  return structured?.[SESSION_NOTE_METAS_KEY] ?? [];
}

/**
 * Monta o jsonb de session_notes.structured a partir dos campos já
 * validados pela Server Action (app/terapeuta/evolucao/actions.ts). Extraído
 * como função pura só para o teste de contrato (tests/session-note-contract.
 * test.ts) conseguir travar o formato sem duplicar a Server Action inteira.
 */
export function buildSessionNoteStructured(input: {
  presencaEngajamento: number;
  metasTrabalhadas: MetaTrabalhada[];
  comportamentos: { tipo: string; intensidade: string }[];
  orientacoes: string[];
}): SessionNoteStructured {
  return {
    presenca_engajamento: input.presencaEngajamento,
    metas_trabalhadas: input.metasTrabalhadas,
    comportamentos: input.comportamentos,
    orientacoes: input.orientacoes,
  };
}
