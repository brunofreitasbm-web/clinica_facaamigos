"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { getActiveAuthorizationId } from "@/lib/active-authorization";

export async function createAppointment(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const patientId = String(formData.get("patient_id") ?? "");
  const therapistId = String(formData.get("therapist_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const appointmentTypeId = String(formData.get("appointment_type_id") ?? "").trim();
  // Presente em app/recepcao/nova-sessao-dialog.tsx desde sempre, mas nunca
  // era lido aqui — o valor escolhido pela recepção era descartado e toda
  // sessão ficava com o default 'individual' da coluna.
  const modality = String(formData.get("modality") ?? "individual").trim() || "individual";
  // "Provisória" (Recepcao.dc.html): recepção agenda mesmo sem guia vigente;
  // is_provisional=true isola essa sessão do guard de autorização quando ela
  // for fechada como 'realizada' (ver appointments_authorization_guard e o
  // checkOut em session-actions.ts, que preserva essa marcação).
  const isProvisional = formData.get("is_provisional") === "on";

  if (!patientId || !therapistId || !roomId || !date || !time || !appointmentTypeId) {
    return { success: false, error: "Preencha todos os campos." };
  }

  const supabase = await createClient();

  // Duração da sessão vem do catálogo cadastrado em /gestor/atendimentos
  // (app/gestor/atendimentos), não mais de um valor fixo de 50min — permite
  // que cada tipo de atendimento (fono, aba, avaliação…) tenha sua própria
  // duração padrão.
  const { data: appointmentType } = await supabase
    .from("appointment_types")
    .select("id, name, duration_minutes")
    .eq("id", appointmentTypeId)
    .maybeSingle();

  if (!appointmentType) {
    return { success: false, error: "Tipo de atendimento inválido." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + appointmentType.duration_minutes * 60 * 1000);

  // Sessões criadas pela agenda são sempre sessões normais (não avaliação —
  // essas são criadas por `scheduleEvaluation`), então precisam de
  // authorization_id pra satisfazer o guard `appointments_authorization_guard`
  // quando marcadas como 'realizada'.
  const authorizationId = await getActiveAuthorizationId(supabase, patientId);

  const { error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline: appointmentType.name,
    appointment_type_id: appointmentType.id,
    modality,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    authorization_id: authorizationId,
    is_provisional: isProvisional,
  });

  if (error) {
    if (error.code === "23P01") {
      return {
        success: false,
        error: "Sala ou terapeuta já tem sessão nesse horário.",
      };
    }
    if (error.message?.includes("exige authorization_id")) {
      return {
        success: false,
        error: "Paciente sem autorização ativa — registre uma guia antes de agendar.",
      };
    }
    return { success: false, error: "Não foi possível agendar. Tente de novo." };
  }

  revalidatePath("/recepcao/agenda");
  revalidatePath("/recepcao");
  return { success: true };
}
