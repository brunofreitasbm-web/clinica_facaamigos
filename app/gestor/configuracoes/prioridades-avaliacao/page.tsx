import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PrioridadesAvaliacaoManager, type PriorityRow } from "./prioridades-manager";

export const dynamic = "force-dynamic";

export default async function PrioridadesAvaliacaoPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("evaluation_appointment_priorities")
    .select("id, insurance_id, priority_level, label, description, color, active")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("priority_level", { ascending: true });

  const { data: insurers } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name", { ascending: true });

  const priorities: PriorityRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    insurance_id: r.insurance_id,
    priority_level: r.priority_level,
    label: r.label,
    description: r.description || "",
    color: r.color || "#6366f1",
    active: r.active,
  }));

  const insurersList = (insurers ?? []).map((i) => ({
    id: i.id,
    name: i.name,
  }));

  return (
    <PrioridadesAvaliacaoManager
      priorities={priorities}
      insurers={insurersList}
    />
  );
}
