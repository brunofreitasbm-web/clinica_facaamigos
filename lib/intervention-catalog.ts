import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type InterventionCatalogItem = {
  id: string;
  value: string;
  label: string;
  discipline: string | null;
};

/**
 * Catálogo de intervenções configurável pelo supervisor
 * (supabase/migrations/20260907170007_intervention_catalog.sql), mesmo
 * desenho de lib/behavior-catalog.ts.
 */
export async function getInterventionCatalog(
  supabase: SupabaseClient<Database>,
  opts: { activeOnly?: boolean } = {},
): Promise<InterventionCatalogItem[]> {
  let query = supabase
    .from("intervention_catalog")
    .select("id, value, label, discipline")
    .order("sort_order", { ascending: true });

  if (opts.activeOnly !== false) {
    query = query.eq("active", true);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Rótulo de um `value` gravado em session_intervention_logs.intervention_value.
 * O catálogo é imutável na prática (desativa, nunca apaga), mas caímos pro
 * próprio valor cru em vez de "undefined" caso um value já tenha sumido.
 */
export function interventionLabel(catalog: InterventionCatalogItem[], value: string): string {
  return catalog.find((i) => i.value === value)?.label ?? value;
}
