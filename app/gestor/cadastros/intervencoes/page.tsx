import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { IntervencoesManager, type InterventionRow } from "./intervencoes-manager";

export const dynamic = "force-dynamic";

export default async function IntervencoesConfigPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("intervention_catalog")
    .select("id, value, label, discipline, active")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("sort_order", { ascending: true });

  const interventions: InterventionRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    value: r.value,
    label: r.label,
    discipline: r.discipline,
    active: r.active,
  }));

  return <IntervencoesManager interventions={interventions} />;
}
