import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { AtendimentosManager } from "./atendimentos-manager";
import type { ResourceRow } from "./types";

export const dynamic = "force-dynamic";

export default async function AtendimentosConfigPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("resources")
    .select("id, name, category, notes")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const resources: ResourceRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    notes: r.notes,
  }));

  return <AtendimentosManager resources={resources} />;
}
