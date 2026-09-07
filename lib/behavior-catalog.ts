import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { LEGACY_BEHAVIOR_TYPES } from "@/lib/session-note-fields";

export type BehaviorCatalogItem = {
  id: string;
  value: string;
  label: string;
  discipline: string | null;
};

/**
 * Lista de comportamentos-alvo configurável pelo supervisor (PRD §9.4),
 * substituindo o BEHAVIOR_TYPES fixo de lib/session-note-fields.ts
 * (supabase/migrations/20260907170001_behavior_catalog.sql).
 */
export async function getBehaviorCatalog(
  supabase: SupabaseClient<Database>,
  opts: { activeOnly?: boolean } = {},
): Promise<BehaviorCatalogItem[]> {
  let query = supabase
    .from("behavior_catalog")
    .select("id, value, label, discipline")
    .order("sort_order", { ascending: true });

  if (opts.activeOnly !== false) {
    query = query.eq("active", true);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Rótulo de um `value` gravado em session_notes.structured.comportamentos[].tipo.
 * Como o catálogo é imutável na prática (desativa, nunca apaga), um `value`
 * de evolução antiga sempre resolve — mas ainda assim caímos pro fallback
 * legado e, por último, pro próprio valor cru, nunca para "undefined".
 */
export function behaviorLabel(catalog: BehaviorCatalogItem[], value: string): string {
  return (
    catalog.find((b) => b.value === value)?.label ??
    LEGACY_BEHAVIOR_TYPES.find((b) => b.value === value)?.label ??
    value
  );
}
