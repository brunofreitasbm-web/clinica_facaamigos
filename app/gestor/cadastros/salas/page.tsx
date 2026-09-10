import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { AtendimentosManager } from "./atendimentos-manager";
import type { AbaClassRow, ResourceRow, RoomRow, SpecialtyOption } from "./types";

export const dynamic = "force-dynamic";

export default async function AtendimentosConfigPage() {
  const supabase = await createClient();

  const [{ data: resourceRows }, { data: roomRows }, { data: specialtyRows }, { data: abaClassRows }] = await Promise.all([
    supabase.from("resources").select("id, name, category, notes").eq("clinic_id", DEV_CLINIC_ID).order("name"),
    supabase
      .from("rooms")
      .select("id, name, capacity, recommended_interns, specialty_id, is_aba_training, is_evaluation_room")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("name"),
    supabase
      .from("specialties")
      .select("id, label")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("aba_training_classes")
      .select("id, room_id, day_of_week, start_time, active, rooms(name, capacity)")
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
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
    recommendedInterns: r.recommended_interns,
    specialtyId: r.specialty_id,
    isAbaTraining: r.is_aba_training,
    isEvaluationRoom: r.is_evaluation_room,
  }));

  const abaClasses: AbaClassRow[] = (abaClassRows ?? []).map((c) => {
    const room = c.rooms as unknown as { name: string; capacity: number } | null;
    return {
      id: c.id,
      roomId: c.room_id,
      roomName: room?.name ?? "Sala",
      capacity: room?.capacity ?? 0,
      dayOfWeek: c.day_of_week,
      startTime: c.start_time,
      active: c.active,
    };
  });

  const specialties: SpecialtyOption[] = (specialtyRows ?? []).map((s) => ({ id: s.id, label: s.label }));

  return (
    <AtendimentosManager
      resources={resources}
      rooms={rooms}
      specialties={specialties}
      abaClasses={abaClasses}
    />
  );
}
