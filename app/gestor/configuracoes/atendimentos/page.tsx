import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { AtendimentosManager } from "./atendimentos-manager";
import type { ResourceRow, RoomRow } from "./types";

export const dynamic = "force-dynamic";

export default async function AtendimentosConfigPage() {
  const supabase = await createClient();

  const [{ data: resourceRows }, { data: roomRows }] = await Promise.all([
    supabase.from("resources").select("id, name, category, notes").eq("clinic_id", DEV_CLINIC_ID).order("name"),
    supabase.from("rooms").select("id, name, capacity").eq("clinic_id", DEV_CLINIC_ID).order("name"),
  ]);

  const resources: ResourceRow[] = (resourceRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    notes: r.notes,
  }));

  const rooms: RoomRow[] = (roomRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
  }));

  return <AtendimentosManager resources={resources} rooms={rooms} />;
}
