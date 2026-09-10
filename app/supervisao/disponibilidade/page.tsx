import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { AvailabilityManager, type AvailabilityBlock, type TherapistOption } from "./availability-manager";

export const dynamic = "force-dynamic";

export default async function DisponibilidadePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role && profile.role !== "supervisor" && profile.role !== "gestor") {
      redirect("/supervisao");
    }
  }

  const [{ data: therapists }, { data: blocks }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("role", "terapeuta")
      .order("full_name"),
    supabase
      .from("professional_availability")
      .select("id, profile_id, day_of_week, start_time, end_time")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("active", true)
      .order("day_of_week")
      .order("start_time"),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Supervisão"
        title="Disponibilidade dos profissionais"
        description="Dias e horários em que cada terapeuta atende — cadastro exclusivo da supervisão e da gestão; o terapeuta apenas visualiza a própria janela. Um agendamento fora dela é bloqueado automaticamente na recepção, na grade recorrente e no calendário do PTS."
      />
      <PageContainer>
        <AvailabilityManager
          therapists={(therapists ?? []) as TherapistOption[]}
          blocks={(blocks ?? []) as AvailabilityBlock[]}
        />
      </PageContainer>
    </main>
  );
}
