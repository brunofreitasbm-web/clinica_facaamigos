"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAppointment } from "@/app/recepcao/agenda/actions";
import { checkIn } from "@/app/recepcao/agenda/session-actions";
import { getSpecialtyPrice } from "@/lib/specialty-prices";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Traduz o bloqueio de `acolhimento_can_schedule`/trigger de transição para
 * 'agendado' (supabase/migrations/20260917170600_acolhimento_requests.sql) —
 * mesmo espírito de `mapAuthorizationGuardError` em session-actions.ts: a
 * regra mora no banco, aqui só vira mensagem em português apontando o que
 * falta resolver.
 */
function mapAcolhimentoScheduleBlocker(reason: string | null): string | null {
  if (!reason) return null;
  if (reason.includes("PEDIDO_MEDICO_AUSENTE")) {
    return "Falta o pedido médico do paciente — anexe o documento (categoria \"Pedido médico\") antes de agendar.";
  }
  if (reason.includes("GUIA_NAO_VALIDADA")) {
    return "A guia do convênio ainda não está validada (status \"ativa\") — valide a autorização antes de agendar.";
  }
  return "Não é possível agendar este acolhimento ainda — confira documentos e autorização do paciente.";
}

/**
 * Agenda a 1ª avaliação de um acolhimento — reusa `createAppointment`
 * (app/recepcao/agenda/actions.ts) com `is_evaluation=true`, depois vincula
 * o appointment criado e avança o status para 'agendado'. Faz um pré-check
 * via RPC `acolhimento_can_schedule` ANTES de criar a sessão: se o convênio
 * ainda não tem pedido médico/guia validada, nem chega a criar o
 * appointment — evita sessão órfã que o trigger ia rejeitar de qualquer
 * jeito na hora do update de status.
 */
export async function scheduleAcolhimento(requestId: string, formData: FormData): Promise<ActionResult> {
  const supervisorId = String(formData.get("supervisor_id") ?? "").trim();
  const therapistId = String(formData.get("therapist_id") ?? "").trim();
  const roomId = String(formData.get("room_id") ?? "").trim();
  const appointmentTypeId = String(formData.get("appointment_type_id") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();

  if (!therapistId || !roomId || !appointmentTypeId || !date || !time) {
    return { success: false, error: "Preencha avaliador, sala, tipo de atendimento, data e horário." };
  }

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("acolhimento_requests")
    .select("id, patient_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return { success: false, error: "Acolhimento não encontrado." };
  }

  const { data: blockReason } = await supabase.rpc("acolhimento_can_schedule", { p_request_id: requestId });
  const blockerMessage = mapAcolhimentoScheduleBlocker(blockReason ?? null);
  if (blockerMessage) {
    return { success: false, error: blockerMessage };
  }

  const appointmentFormData = new FormData();
  appointmentFormData.set("patient_id", request.patient_id);
  appointmentFormData.set("therapist_id", therapistId);
  appointmentFormData.set("room_id", roomId);
  appointmentFormData.set("appointment_type_id", appointmentTypeId);
  appointmentFormData.set("date", date);
  appointmentFormData.set("time", time);
  appointmentFormData.set("is_evaluation", "true");

  const appointmentResult = await createAppointment(appointmentFormData);
  if (!appointmentResult.success) {
    return { success: false, error: appointmentResult.error };
  }

  const { error: updateError } = await supabase
    .from("acolhimento_requests")
    .update({
      appointment_id: appointmentResult.appointmentId,
      scheduled_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      supervisor_id: supervisorId || null,
      status: "agendado",
    })
    .eq("id", requestId);

  if (updateError) {
    const blocked = mapAcolhimentoScheduleBlocker(updateError.message);
    return { success: false, error: blocked ?? "Sessão agendada, mas não foi possível atualizar o status do acolhimento." };
  }

  revalidatePath("/recepcao/acolhimentos");
  revalidatePath("/recepcao/agenda");
  revalidatePath("/recepcao");
  revalidatePath("/supervisao");
  return { success: true };
}

/**
 * Confirma a chegada do paciente pro acolhimento — particular gera e já
 * marca como paga uma cobrança da 1ª avaliação (recepção cobra
 * presencialmente); convênio pula direto pro check-in (a guia já cobre).
 * Em ambos os casos, `checkIn` (session-actions.ts, porta única de
 * check-in) é quem registra a chegada de fato.
 */
export async function confirmAcolhimentoArrival(requestId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("acolhimento_requests")
    .select("id, patient_id, funding, specialty_value, appointment_id, patients(full_name)")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return { success: false, error: "Acolhimento não encontrado." };
  }
  if (!request.appointment_id) {
    return { success: false, error: "Este acolhimento ainda não tem avaliação agendada." };
  }

  const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
  const now = new Date().toISOString();

  if (request.funding === "particular") {
    const amountRaw = String(formData.get("amount") ?? "").replace(",", ".");
    let amount = Number(amountRaw);

    if (!Number.isFinite(amount) || amount <= 0) {
      // Sem valor informado na tela — tenta a tabela viva de preços
      // particulares (lib/specialty-prices.ts) pela especialidade do pedido.
      const price = request.specialty_value ? await getSpecialtyPrice(supabase, DEV_CLINIC_ID, request.specialty_value) : null;
      amount = price?.price ?? NaN;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Informe o valor cobrado pela 1ª avaliação (não há preço cadastrado para esta especialidade)." };
    }

    const { error: chargeError } = await supabase.from("patient_charges").insert({
      patient_id: request.patient_id,
      appointment_id: request.appointment_id,
      description: `Acolhimento — ${patient?.full_name ?? "paciente"}`,
      amount,
      status: "pago",
      paid_at: now,
    });

    if (chargeError) {
      return { success: false, error: "Não foi possível registrar a cobrança da 1ª avaliação." };
    }
  }

  const checkinResult = await checkIn(request.appointment_id);
  if (!checkinResult.success) {
    return { success: false, error: checkinResult.error };
  }

  const { error: updateError } = await supabase
    .from("acolhimento_requests")
    .update({
      status: "realizado",
      presence_confirmed_at: now,
      payment_confirmed_at: request.funding === "particular" ? now : null,
    })
    .eq("id", requestId);

  if (updateError) {
    return { success: false, error: "Presença registrada, mas não foi possível atualizar o status do acolhimento." };
  }

  revalidatePath("/recepcao/acolhimentos");
  revalidatePath("/recepcao/agenda");
  revalidatePath("/recepcao");
  return { success: true };
}

/** Marca que o contrato foi entregue à família — avança pra 'contrato_pendente'. */
export async function deliverContract(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("acolhimento_requests")
    .update({ contract_delivered_at: new Date().toISOString(), status: "contrato_pendente" })
    .eq("id", requestId);

  if (error) return { success: false, error: "Não foi possível registrar a entrega do contrato." };

  revalidatePath("/recepcao/acolhimentos");
  return { success: true };
}

/**
 * Fecha o acolhimento avisando a família — se `whatsappGroup` estiver
 * marcado, também inclui o paciente no grupo de WhatsApp
 * (`patients.whatsapp_group_added_at`, mesmo campo usado no resto da
 * jornada de entrada).
 */
export async function informFamily(requestId: string, formData: FormData): Promise<ActionResult> {
  const whatsappGroup = formData.get("whatsappGroup") === "on";
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("acolhimento_requests")
    .select("id, patient_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { success: false, error: "Acolhimento não encontrado." };

  const now = new Date().toISOString();

  if (whatsappGroup) {
    const { error: patientError } = await supabase
      .from("patients")
      .update({ whatsapp_group_added_at: now })
      .eq("id", request.patient_id);
    if (patientError) {
      return { success: false, error: "Não foi possível marcar a inclusão no grupo de WhatsApp." };
    }
  }

  const { error } = await supabase
    .from("acolhimento_requests")
    .update({
      family_informed_at: now,
      whatsapp_group_at: whatsappGroup ? now : null,
      status: "concluido",
    })
    .eq("id", requestId);

  if (error) return { success: false, error: "Não foi possível concluir o acolhimento." };

  revalidatePath("/recepcao/acolhimentos");
  return { success: true };
}
