import { GestorNav } from "@/components/gestor-nav";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { AtendimentosManager } from "./atendimentos-manager";
import type { AppointmentType } from "./types";

export const dynamic = "force-dynamic";

export default async function AtendimentosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment_types")
    .select("id, name, modality, duration_minutes, display_interval_minutes, recurrence, active")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const appointmentTypes: AppointmentType[] = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    modality: t.modality,
    durationMinutes: t.duration_minutes,
    displayIntervalMinutes: t.display_interval_minutes,
    recurrence: t.recurrence,
    active: t.active,
  }));

  return (
    <main className="flex flex-1 flex-col">
      <GestorNav active="cadastros" />
      <PageHeader
        axisLabel="Gestor"
        title="Atendimentos"
        description="Crie tipos de atendimento definindo duração e recorrência. Personalize formatos como consultas rápidas, sessões longas ou atendimentos semanais."
      />
      <AtendimentosManager appointmentTypes={appointmentTypes} />
    </main>
  );
}
