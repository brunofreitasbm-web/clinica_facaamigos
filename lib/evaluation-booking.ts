// lib/evaluation-booking.ts
/**
 * Shape único do insert de sessão de avaliação/anamnese — usado tanto pelo
 * agendamento manual da recepção (scheduleEvaluation em
 * app/recepcao/pacientes/[id]/stage-actions.ts) quanto pelo agendamento
 * autônomo do bot do WhatsApp (lib/whatsapp/booking.ts). Extraído pra não
 * duplicar o shape do insert (duração, discipline, is_evaluation) em dois
 * lugares que precisam ficar sempre iguais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type ActionResult = { success: true; appointmentId: string } | { success: false; error: string };

export async function insertEvaluationAppointment(
  supabase: SupabaseClient<Database>,
  params: {
    patientId: string;
    therapistId: string;
    roomId: string;
    startsAtIso: string;
    endsAtIso: string;
  },
): Promise<ActionResult> {
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      patient_id: params.patientId,
      therapist_id: params.therapistId,
      room_id: params.roomId,
      discipline: "avaliacao",
      starts_at: params.startsAtIso,
      ends_at: params.endsAtIso,
      status: "agendada",
      is_evaluation: true,
    })
    .select("id")
    .single();

  if (apptError || !appointment) {
    if (apptError?.code === "23P01") {
      return { success: false, error: "Sala ou terapeuta já tem sessão nesse horário." };
    }
    return { success: false, error: "Não foi possível agendar a avaliação." };
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ status: "avaliacao" })
    .eq("id", params.patientId);

  if (patientError) {
    return { success: false, error: "Avaliação agendada, mas houve erro ao atualizar o status do paciente." };
  }

  return { success: true, appointmentId: appointment.id };
}
