"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { checkIn, undoAutoFalta } from "@/app/recepcao/agenda/session-actions";

type ActionResult = { success: true; warning?: string } | { success: false; error: string };

const SESSION_EXPIRED_ERROR: ActionResult = {
  success: false,
  error: "Sessão expirada. Faça login novamente.",
};

function revalidateChegadasViews() {
  revalidatePath("/recepcao/chegadas");
  revalidatePath("/recepcao");
}

/**
 * Confirma uma chegada declarada pelo QR: encadeia undoAutoFalta() (se a
 * rotina de 5min já tiver marcado falta enquanto a família esperava) e
 * checkIn() — a MESMA porta que o botão manual da agenda usa, para não
 * duplicar a checagem de guia (buildAuthorizationWarning) nem o WhatsApp ao
 * terapeuta (notifyTherapistOfFirstCheckIn). O `warning` de guia devolvido
 * por checkIn() precisa ser exibido pela UI — é o único ponto do fluxo do QR
 * em que a recepção olha a autorização antes do atendimento (ver F22 do plano).
 */
export async function confirmCheckinRequest(requestId: string, appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SESSION_EXPIRED_ERROR;

  const { data: request } = await supabase
    .from("checkin_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request || request.status !== "aguardando") {
    return { success: false, error: "Essa chegada já foi resolvida." };
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("status, auto_marked")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }

  // A rotina de 5min pode ter marcado falta automática enquanto a família
  // esperava na sala (o guard em auto_resolve_appointments cobre a maioria
  // dos casos, mas não a janela entre a expiração da chegada e o clique).
  if (appointment.status === "falta_familia" && appointment.auto_marked) {
    const undone = await undoAutoFalta(appointmentId);
    if (!undone.success) return undone;
  }

  const result = await checkIn(appointmentId);
  if (!result.success) return result;

  const { error: updateError } = await supabase
    .from("checkin_requests")
    .update({
      status: "confirmado",
      appointment_id: appointmentId,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", requestId)
    .eq("status", "aguardando"); // guarda contra confirmação dupla (dois cliques)

  if (updateError) {
    console.error("[confirmCheckinRequest] check-in feito mas não marcou a chegada como confirmada:", updateError);
  }

  revalidateChegadasViews();
  return result;
}

/** Descarta uma chegada — visitante que não era paciente, engano, teste. */
export async function discardCheckinRequest(requestId: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SESSION_EXPIRED_ERROR;

  const { error } = await supabase
    .from("checkin_requests")
    .update({
      status: "descartado",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_note: note || null,
    })
    .eq("id", requestId)
    .eq("status", "aguardando");

  if (error) {
    return { success: false, error: "Não foi possível descartar a chegada." };
  }

  revalidateChegadasViews();
  return { success: true };
}

/**
 * Vincula manualmente uma chegada "sem agendamento" (visitante) a um
 * appointment específico escolhido pela recepção — cobre o caso de nome
 * digitado muito diferente do cadastro ou de a busca não ter encontrado a
 * sessão certa (F14/F15 do plano). Não confirma o check-in sozinho: a
 * recepção ainda revisa e clica Confirmar depois.
 */
export async function linkVisitorToPatient(requestId: string, patientId: string, appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("checkin_requests")
    .update({ kind: "agendado", patient_id: patientId, appointment_id: appointmentId, match_quality: "ambiguo" })
    .eq("id", requestId)
    .eq("status", "aguardando");

  if (error) {
    return { success: false, error: "Não foi possível vincular ao paciente." };
  }

  revalidateChegadasViews();
  return { success: true };
}

/**
 * Lançamento manual de chegada pela recepção — para quem não tem celular ou
 * cujo tablet da entrada está fora do ar (F11/F12 do plano). Usa a mesma
 * tabela e o mesmo trigger de numeração de senha do fluxo do QR, então a
 * fila física continua sendo uma só.
 */
export async function createManualCheckinRequest(appointmentId: string, patientId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const todayStr = todayInTimeZone(CLINIC_TIMEZONE);

  const { error } = await supabase.from("checkin_requests").insert({
    clinic_id: DEV_CLINIC_ID,
    service_date: todayStr,
    kind: "agendado",
    patient_id: patientId,
    appointment_id: appointmentId,
    match_quality: "exato",
    declared_first_name: "(lançado pela recepção)",
    declared_birth_date: "1900-01-01",
    source: "recepcao",
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Já existe uma chegada em aberto para essa sessão." };
    }
    return { success: false, error: "Não foi possível lançar a chegada." };
  }

  revalidateChegadasViews();
  return { success: true };
}
