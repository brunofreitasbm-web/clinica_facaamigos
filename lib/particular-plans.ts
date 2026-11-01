import type { SupabaseClient } from "@supabase/supabase-js";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PLAN_CODE_PREFIX, parsePlanRows, type CatalogPlan } from "@/lib/particular-plans-pure";

/**
 * Planos particulares vigentes (valor do pacote global). Lê
 * `insurer_price_tables` do convênio "Particular"; devolve lista vazia se a
 * consulta falhar (quem chama decide a reserva).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadParticularPlanCatalog(supabase: SupabaseClient<any>): Promise<CatalogPlan[]> {
  const { data, error } = await supabase
    .from("insurer_price_tables")
    .select("procedure_code, procedure_name, price, valid_from, valid_to, session_frequency_note, insurers!inner(name, clinic_id)")
    .eq("insurers.clinic_id", DEV_CLINIC_ID)
    .ilike("insurers.name", "particular")
    .like("procedure_code", `${PLAN_CODE_PREFIX}%`);
  if (error) {
    console.error("[Particular Plans] Falha ao ler o catálogo:", error.message);
    return [];
  }
  return parsePlanRows(data ?? [], new Date().toISOString().slice(0, 10));
}
