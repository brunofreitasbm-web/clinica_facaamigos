import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;
type Views = Database["public"]["Views"];

export type KpiRow = Views["metabase_ux_friction_kpis"]["Row"];
export type PageRow = Views["metabase_ux_friction_by_page"]["Row"];
export type ElementRow = Views["metabase_ux_friction_by_element"]["Row"];
export type LoopRow = Views["metabase_ux_navigation_loops"]["Row"];

export interface FrictionReport {
  /** Segunda-feira da semana exibida (YYYY-MM-DD); null se ainda não há dado. */
  semana: string | null;
  /** Linhas de KPI da semana exibida: "todos" + uma por papel. */
  kpis: KpiRow[];
  /** Histórico do KPI geral ("todos"), da semana mais recente para trás. */
  history: KpiRow[];
  pages: PageRow[];
  elements: ElementRow[];
  loops: LoopRow[];
}

const HISTORY_WEEKS = 8;

/**
 * Lê as views `metabase_ux_*` (migration 20260929000000) com o client de
 * sessão: a RLS de `ux_events` + `security_invoker` nas views garantem que só o
 * gestor da clínica vê algo. Os relatórios seguem a mesma fonte que o
 * Metabase usaria; aqui só mudou onde eles são exibidos.
 */
export async function getFrictionReport(supabase: Supa, clinicId: string): Promise<FrictionReport> {
  const { data: historyRows } = await supabase
    .from("metabase_ux_friction_kpis")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("papel", "todos")
    .order("semana", { ascending: false })
    .limit(HISTORY_WEEKS);

  const history = historyRows ?? [];
  const semana = history[0]?.semana ?? null;
  if (!semana) return { semana: null, kpis: [], history: [], pages: [], elements: [], loops: [] };

  const [kpis, pages, elements, loops] = await Promise.all([
    supabase.from("metabase_ux_friction_kpis").select("*").eq("clinic_id", clinicId).eq("semana", semana),
    supabase
      .from("metabase_ux_friction_by_page")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("semana", semana)
      .gt("sinais", 0)
      .order("prioridade", { ascending: true })
      .limit(10),
    supabase
      .from("metabase_ux_friction_by_element")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("semana", semana)
      .order("ocorrencias_atual", { ascending: false })
      .limit(10),
    supabase
      .from("metabase_ux_navigation_loops")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("semana", semana)
      .order("idas_e_voltas_atual", { ascending: false })
      .limit(10),
  ]);

  return {
    semana,
    kpis: kpis.data ?? [],
    history,
    pages: pages.data ?? [],
    elements: elements.data ?? [],
    loops: loops.data ?? [],
  };
}
