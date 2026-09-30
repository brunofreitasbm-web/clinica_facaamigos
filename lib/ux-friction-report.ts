// lib/ux-friction-report.ts
//
// Regras PURAS de apresentação da tela "Facilidade de uso"
// (app/gestor/facilidade-de-uso). Sem React e sem banco, para poder testar.
//
// Todos os indicadores desta tela são do tipo "quanto MENOR, melhor" (menos
// tropeços, menos segundos até agir), e todo indicador é mostrado com o
// comparativo da semana anterior e a meta (AGENTS.md, regra nº 1).

export type Trend = "melhor" | "pior" | "igual" | "sem_comparacao";
export type Tone = "bom" | "atencao" | "sem_dados";

export interface Comparison {
  trend: Trend;
  /** atual - anterior (positivo = subiu). Null se não há comparação. */
  delta: number | null;
  /** Dentro da meta (atual <= meta). Null se não há valor ou meta. */
  withinGoal: boolean | null;
  tone: Tone;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compara um indicador "menor é melhor" com a semana anterior e com a meta.
 * `tolerance` evita chamar de "piorou" uma oscilação de centésimos.
 */
export function compareLowerIsBetter(
  atual: unknown,
  anterior: unknown,
  meta: unknown,
  tolerance = 0.05,
): Comparison {
  const a = num(atual);
  const p = num(anterior);
  const m = num(meta);

  if (a === null) return { trend: "sem_comparacao", delta: null, withinGoal: null, tone: "sem_dados" };

  const delta = p === null ? null : Math.round((a - p) * 100) / 100;
  const trend: Trend = delta === null ? "sem_comparacao" : Math.abs(delta) <= tolerance ? "igual" : delta < 0 ? "melhor" : "pior";
  const withinGoal = m === null ? null : a <= m;
  // Só é "bom" se está dentro da meta e não piorou; qualquer outro caso pede atenção.
  const tone: Tone = withinGoal !== false && trend !== "pior" ? "bom" : "atencao";
  return { trend, delta, withinGoal, tone };
}

export function formatNumber(value: unknown, digits = 1): string {
  const n = num(value);
  if (n === null) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** Ex.: "piorou 3,2 pp vs semana passada" / "melhorou 1,5 s vs semana passada". */
export function describeTrend(c: Comparison, unit: string): string {
  if (c.trend === "sem_comparacao" || c.delta === null) return "sem semana anterior para comparar";
  if (c.trend === "igual") return "igual à semana passada";
  const verb = c.trend === "melhor" ? "melhorou" : "piorou";
  return `${verb} ${formatNumber(Math.abs(c.delta))} ${unit} vs semana passada`;
}

const ROUTE_WORDS: Record<string, string> = {
  recepcao: "Recepção",
  terapeuta: "Terapeuta",
  gestor: "Gestão",
  supervisao: "Supervisão",
  faturamento: "Faturamento",
  atendimento: "Atendimento",
  pacientes: "Pacientes",
  paciente: "Paciente",
  agenda: "Agenda",
  pendencias: "Pendências",
  documentos: "Documentos",
  chegadas: "Chegadas",
  emergencias: "Emergências",
  metricas: "Métricas",
  glosas: "Glosas",
  repasses: "Repasses",
  competencias: "Competências",
  dashboard: "Painel",
  inteligencia: "Inteligência BI",
  configuracoes: "Configurações",
  cadastros: "Cadastros",
  contratos: "Contratos",
  convenios: "Convênios",
  equipe: "Equipe",
  auditoria: "Auditoria",
  bonificacao: "Bonificação",
  financeiro: "Financeiro",
  "financeiro-hub": "Financeiro HUB",
  editar: "Editar",
  novo: "Novo",
  whatsapp: "WhatsApp",
  "pre-cadastros": "Pré-cadastros",
  protocolos: "Protocolos",
  ouvidoria: "Ouvidoria",
  nps: "NPS",
  metas: "Metas",
  maturidade: "Maturidade",
  "facilidade-de-uso": "Facilidade de uso",
};

/** "/recepcao/pacientes/:id/editar" → "Recepção › Pacientes › (um paciente) › Editar". */
export function describeRoute(route: string): string {
  const parts = String(route ?? "").split("/").filter(Boolean);
  if (parts.length === 0) return "Início";
  return parts
    .map((p) => {
      if (p === ":id") return "(um item)";
      if (ROUTE_WORDS[p]) return ROUTE_WORDS[p];
      const words = p.replace(/-/g, " ");
      return words.charAt(0).toUpperCase() + words.slice(1);
    })
    .join(" › ");
}
