import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ModalidadesAtManager, type AtModalityRow } from "./modalidades-at-manager";

export const dynamic = "force-dynamic";

export default async function ModalidadesAtConfigPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("at_modalities")
    .select("id, name, description, active")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const modalities: AtModalityRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    active: r.active,
  }));

  return <ModalidadesAtManager modalities={modalities} />;
}
