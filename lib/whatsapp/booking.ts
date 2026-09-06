// lib/whatsapp/booking.ts
/**
 * Reserva definitiva do horário escolhido pelo responsável. Não faz
 * pré-checagem de disponibilidade: o exclusion constraint GiST em
 * `appointments` (sala e terapeuta, ver supabase/migrations/20260904000006_appointments.sql)
 * já garante atomicidade — se dois responsáveis escolherem o mesmo slot ao
 * mesmo tempo, só um insert passa; o outro recebe `23P01` e o chamador
 * (lib/whatsapp/bot.ts) reoferece horários atualizados.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { insertEvaluationAppointment } from "@/lib/evaluation-booking";
import type { EvaluationSlot } from "./slots";

export type BookEvaluationResult =
  | { status: "booked"; appointmentId: string }
  | { status: "slot_taken" }
  | { status: "error"; message: string };

export async function bookEvaluation(
  requestId: string,
  patientId: string,
  supervisorProfileId: string,
  slot: EvaluationSlot,
): Promise<BookEvaluationResult> {
  const admin = createAdminClient();

  // Pré-condição do fluxo do bot (seção E do plano): só reserva se o
  // supervisor já aprovou os documentos — nada no banco impede agendar sem
  // isso (a trigger appointments_authorization_guard só valida ao virar
  // 'realizada'), então a regra fica na aplicação.
  const { data: request } = await admin
    .from("evaluation_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();

  if (request?.status !== "aprovada") {
    return { status: "error", message: "Pedido de avaliação ainda não foi aprovado pelo supervisor." };
  }

  const result = await insertEvaluationAppointment(admin, {
    patientId,
    therapistId: supervisorProfileId,
    roomId: slot.roomId,
    startsAtIso: slot.startsAtIso,
    endsAtIso: slot.endsAtIso,
  });

  if (!result.success) {
    if (result.error.includes("já tem sessão")) return { status: "slot_taken" };
    return { status: "error", message: result.error };
  }

  await admin
    .from("evaluation_requests")
    .update({ status: "agendada", appointment_id: result.appointmentId })
    .eq("id", requestId);

  return { status: "booked", appointmentId: result.appointmentId };
}
