import type { Role } from "@/lib/roles";

/**
 * Catálogo de métricas do §10 do PRD, por cargo — usado só pra popular o
 * dropdown de cadastro de meta com rótulo/direção corretos (não é uma
 * restrição de schema: `targets.metric_key` continua text livre no banco,
 * então uma meta cadastrada fora daqui não quebra nada, só não ganha label
 * bonito). `computed` marca as poucas métricas que já têm pipeline real de
 * cálculo (close_monthly_metric_snapshots, migration 20260904000027) — as
 * demais aparecem no cadastro mas a tela de atingimento avisa que ainda não
 * há cálculo, em vez de inventar número.
 */
export type MetricDirection = "min" | "max"; // min: maior é melhor (meta é piso) · max: menor é melhor (meta é teto)

export type MetricDef = {
  key: string;
  label: string;
  direction: MetricDirection;
  unit: "pct" | "dias" | "min" | "score";
  eliminatory?: boolean;
  computed: boolean;
};

export const METRIC_CATALOG: Partial<Record<Role, MetricDef[]>> = {
  recepcao: [
    { key: "first_response_min", label: "Tempo de primeira resposta", direction: "max", unit: "min", computed: false },
    { key: "lead_to_eval_rate", label: "Lead → avaliação agendada", direction: "min", unit: "pct", computed: false },
    { key: "eval_show_rate", label: "Avaliação realizada / agendada", direction: "min", unit: "pct", computed: false },
    { key: "confirm_d1_rate", label: "Confirmação D-1", direction: "min", unit: "pct", computed: false },
    { key: "no_show_rate", label: "No-show", direction: "max", unit: "pct", computed: true },
    { key: "recovery_rate", label: "Recuperação de faltas", direction: "min", unit: "pct", computed: false },
    { key: "intake_complete_rate", label: "Cadastro completo antes da 1ª sessão", direction: "min", unit: "pct", computed: false },
    { key: "no_auth_sessions", label: "Sessões sem guia vigente", direction: "max", unit: "pct", eliminatory: true, computed: false },
  ],
  supervisor: [
    { key: "occupancy_rate", label: "Ocupação de agenda", direction: "min", unit: "pct", computed: true },
    { key: "room_occupancy", label: "Ocupação de sala", direction: "min", unit: "pct", computed: false },
    { key: "queue_days", label: "Dias até 1ª sessão", direction: "max", unit: "dias", computed: false },
    { key: "churn_rate", label: "Evasão", direction: "max", unit: "pct", computed: false },
    { key: "clinic_cancel_rate", label: "Cancelamento pela clínica/terapeuta", direction: "max", unit: "pct", computed: false },
    { key: "review_on_time", label: "Reavaliações em dia", direction: "min", unit: "pct", computed: false },
    { key: "auth_first_pass", label: "Autorização aprovada de primeira", direction: "min", unit: "pct", computed: false },
  ],
  terapeuta: [
    { key: "note_24h_rate", label: "Evolução em até 24h", direction: "min", unit: "pct", computed: false },
    { key: "data_collection_rate", label: "Coleta de dados por sessão", direction: "min", unit: "pct", computed: false },
    { key: "therapist_cancel_rate", label: "Cancelamento pelo terapeuta", direction: "max", unit: "pct", computed: false },
    { key: "report_on_time", label: "Relatórios em dia", direction: "min", unit: "pct", computed: false },
    { key: "retention_90d", label: "Retenção 90 dias", direction: "min", unit: "pct", computed: false },
    { key: "goal_progress", label: "Metas atingidas no trimestre", direction: "min", unit: "pct", computed: false },
    { key: "family_nps", label: "NPS da família (sobre o terapeuta)", direction: "min", unit: "score", computed: false },
    { key: "attributable_glosa", label: "Glosa atribuível ao terapeuta", direction: "max", unit: "pct", computed: false },
  ],
  faturamento: [
    { key: "glosa_rate", label: "Glosa sobre faturado", direction: "max", unit: "pct", computed: true },
    { key: "glosa_recovery", label: "Recuperação de glosa", direction: "min", unit: "pct", computed: false },
    { key: "batch_lead_days", label: "Dias até exportar lote", direction: "max", unit: "dias", computed: false },
    { key: "dso_days", label: "Dias até o pagamento (DSO)", direction: "max", unit: "dias", computed: false },
    { key: "no_auth_sessions", label: "Sessões sem guia vigente", direction: "max", unit: "pct", eliminatory: true, computed: false },
  ],
};

export const TARGET_ROLES: Role[] = ["recepcao", "supervisor", "terapeuta", "faturamento"];

export function findMetricDef(role: string, metricKey: string): MetricDef | undefined {
  return METRIC_CATALOG[role as Role]?.find((m) => m.key === metricKey);
}

export function formatMetricValue(value: number, unit: MetricDef["unit"]): string {
  if (unit === "pct") return `${(value * 100).toFixed(1)}%`;
  if (unit === "dias") return `${value.toFixed(0)} dia(s)`;
  if (unit === "min") return `${value.toFixed(0)} min`;
  return value.toFixed(1);
}
