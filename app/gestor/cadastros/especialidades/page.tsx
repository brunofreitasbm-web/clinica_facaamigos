import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { EspecialidadesManager, type SpecialtyRow } from "./especialidades-manager";

export const dynamic = "force-dynamic";

export default async function EspecialidadesConfigPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("specialties")
    .select("id, value, label, active, intern_count, pj_count")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("sort_order", { ascending: true });

  const specialties: SpecialtyRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    value: r.value,
    label: r.label,
    active: r.active,
    internCount: r.intern_count,
    pjCount: r.pj_count,
  }));

  return <EspecialidadesManager specialties={specialties} />;
}
