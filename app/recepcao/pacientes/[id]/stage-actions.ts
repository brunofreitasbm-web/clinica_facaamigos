"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { getActiveAuthorizationId } from "@/lib/active-authorization";
import { CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-stage";
import { dispatchAnamnesisPrefillRequest } from "@/lib/anamnesis-prefill";

type ActionResult = { success: true } | { success: false; error: string };

export async function scheduleEvaluation(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const therapistId = String(formData.get("therapist_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");

  if (!therapistId || !roomId || !date || !time) {
    return { success: false, error: "Preencha terapeuta, sala, data e hora." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

  const supabase = await createClient();
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      therapist_id: therapistId,
      room_id: roomId,
      discipline: "avaliacao",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
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
    .eq("id", patientId);

  if (patientError) {
    return { success: false, error: "Avaliação agendada, mas houve erro ao atualizar o status do paciente." };
  }

  // Convite de anamnese assíncrona por WhatsApp (ver lib/anamnesis-prefill.ts)
  // — reforço opcional para o terapeuta chegar mais preparado; não bloqueia
  // o agendamento se falhar (Twilio fora do ar, sem responsável cadastrado
  // etc.), a anamnese continua acontecendo presencialmente.
  await dispatchAnamnesisPrefillRequest({
    patientId,
    appointmentId: appointment.id,
    startsAt: startsAt.toISOString(),
  });

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function markEvaluationDone(patientId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: evalAppointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .eq("is_evaluation", true)
    .not("status", "in", `(${CANCELLED_APPOINTMENT_STATUSES.join(",")})`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!evalAppointment) {
    return {
      success: false,
      error: "Nenhuma avaliação agendada (não cancelada) encontrada pra este paciente.",
    };
  }

  // Sessões de avaliação não têm autorização de convênio associada — usamos
  // is_provisional para satisfazer o guard `appointments_authorization_guard`,
  // que exige authorization_id em qualquer status='realizada' não provisório.
  const { error: apptError } = await supabase
    .from("appointments")
    .update({ status: "realizada", is_provisional: true })
    .eq("id", evalAppointment.id);

  if (apptError) {
    return { success: false, error: "Não foi possível marcar a avaliação como realizada." };
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ evaluated_at: new Date().toISOString() })
    .eq("id", patientId);

  if (patientError) {
    return { success: false, error: "Avaliação marcada, mas houve erro ao atualizar o paciente." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function registerAuthorization(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const insurerId = String(formData.get("insurer_id") ?? "");
  const guideNumber = String(formData.get("guide_number") ?? "").trim();
  const procedureCode = String(formData.get("procedure_code") ?? "").trim();
  const sessionsAuthorized = Number(formData.get("sessions_authorized") ?? 0);
  const validFrom = String(formData.get("valid_from") ?? "");
  const validTo = String(formData.get("valid_to") ?? "");
  // Senha de autorização: a maioria dos convênios emite separada do número
  // da guia, com vigência própria — nem todo plano emite (por isso ambos
  // opcionais). Ver migration 20260905170000_authorization_password.
  const authorizationPassword = String(formData.get("authorization_password") ?? "").trim();
  const passwordValidUntil = String(formData.get("password_valid_until") ?? "").trim();
  // CID (patients.cid, migration 20260904000002): existia a coluna mas
  // nenhum formulário gravava nela — a recepção só descobre o CID nesse
  // estágio (documentação do convênio), então captura junto da autorização.
  const cid = String(formData.get("cid") ?? "").trim();

  if (!insurerId || !procedureCode || !sessionsAuthorized || !validFrom || !validTo) {
    return { success: false, error: "Preencha convênio, procedimento, sessões autorizadas e vigência." };
  }

  const supabase = await createClient();

  // Reaproveita o vínculo patient_insurance já existente para esse
  // paciente+convênio em vez de duplicar a linha a cada nova guia — uma
  // única (patient_id, insurer_id) pode ter várias autorizações ao longo
  // do tempo (ex.: renovação de guia).
  const { data: existingInsurance, error: lookupError } = await supabase
    .from("patient_insurance")
    .select("id")
    .eq("patient_id", patientId)
    .eq("insurer_id", insurerId)
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: "Não foi possível verificar o convênio do paciente." };
  }

  let patientInsuranceId = existingInsurance?.id ?? null;

  if (!patientInsuranceId) {
    const { data: patientInsurance, error: piError } = await supabase
      .from("patient_insurance")
      .insert({ patient_id: patientId, insurer_id: insurerId, is_private: false })
      .select("id")
      .single();

    if (piError || !patientInsurance) {
      return { success: false, error: "Não foi possível vincular o convênio ao paciente." };
    }
    patientInsuranceId = patientInsurance.id;
  }

  const { error: authError } = await supabase.from("authorizations").insert({
    patient_insurance_id: patientInsuranceId,
    guide_number: guideNumber || null,
    procedure_code: procedureCode,
    sessions_authorized: sessionsAuthorized,
    valid_from: validFrom,
    valid_to: validTo,
    status: "ativa",
    authorization_password: authorizationPassword || null,
    password_valid_until: passwordValidUntil || null,
  });

  if (authError) {
    return { success: false, error: "Convênio vinculado, mas houve erro ao registrar a autorização." };
  }

  if (cid) {
    const { error: cidError } = await supabase.from("patients").update({ cid }).eq("id", patientId);
    if (cidError) {
      return { success: false, error: "Autorização registrada, mas houve erro ao salvar o CID do paciente." };
    }
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

/**
 * Marca um responsável como contato de emergência (PRD §1 — header de
 * identificação do paciente). No máximo um por paciente — desmarca os
 * outros antes, porque `guardians_one_emergency_contact_per_patient`
 * (índice único parcial) rejeitaria dois marcados ao mesmo tempo.
 */
export async function setEmergencyContact(patientId: string, guardianId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("guardians")
    .update({ is_emergency_contact: false })
    .eq("patient_id", patientId)
    .neq("id", guardianId);

  if (clearError) {
    return { success: false, error: "Não foi possível atualizar o contato de emergência." };
  }

  const { error: setError } = await supabase
    .from("guardians")
    .update({ is_emergency_contact: true })
    .eq("id", guardianId);

  if (setError) {
    return { success: false, error: "Não foi possível marcar este responsável como contato de emergência." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

/**
 * Etapas do checklist de entrada (Módulo 3 MAAIS) sem trigger automático —
 * dependem de uma confirmação manual da recepção/supervisão porque não têm
 * uma coluna/evento próprio no banco para disparar (ex.: "grupo de WhatsApp"
 * é uma ação fora do sistema; "contrato enviado" é um e-mail/mensagem, não um
 * upload). As etapas com trigger (ex.: contrato_assinado ao subir o
 * documento, anamnese_realizada ao salvar a anamnese) não usam esta função —
 * ver supabase/migrations/20260906000001_intake_journey.sql.
 */
export async function completeIntakeStep(patientId: string, stepKey: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase
    .from("intake_steps")
    .update({ status: "concluida", completed_at: new Date().toISOString(), completed_by: user.id })
    .eq("patient_id", patientId)
    .eq("step_key", stepKey)
    .eq("status", "pendente");

  if (error) return { success: false, error: "Não foi possível concluir a etapa." };

  // Atalhos que também gravam a coluna correspondente em `patients`, pra que
  // o checklist e o cabeçalho do prontuário nunca divirjam.
  if (stepKey === "grupo_whatsapp") {
    await supabase
      .from("patients")
      .update({ whatsapp_group_added_at: new Date().toISOString() })
      .eq("id", patientId)
      .is("whatsapp_group_added_at", null);
  }
  if (stepKey === "contrato_enviado") {
    await supabase
      .from("patients")
      .update({ contract_sent_at: new Date().toISOString() })
      .eq("id", patientId)
      .is("contract_sent_at", null);
  }
  if (stepKey === "pagamento_confirmado") {
    await supabase
      .from("patients")
      .update({ payment_confirmed_at: new Date().toISOString() })
      .eq("id", patientId)
      .is("payment_confirmed_at", null);
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function activatePatient(patientId: string, formData: FormData): Promise<ActionResult> {
  const therapistId = String(formData.get("therapist_id") ?? "");
  const roomId = String(formData.get("room_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const discipline = String(formData.get("discipline") ?? "").trim();

  if (!therapistId || !roomId || !date || !time || !discipline) {
    return { success: false, error: "Preencha terapeuta, sala, data, hora e disciplina." };
  }

  const supabase = await createClient();

  const authorizationId = await getActiveAuthorizationId(supabase, patientId, discipline);

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

  const { error: apptError } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    authorization_id: authorizationId,
  });

  if (apptError) {
    if (apptError.code === "23P01") {
      return { success: false, error: "Sala ou terapeuta já tem sessão nesse horário." };
    }
    return { success: false, error: "Não foi possível criar a primeira sessão da grade." };
  }

  const { error: patientError } = await supabase
    .from("patients")
    .update({ status: "ativo", first_session_at: startsAt.toISOString() })
    .eq("id", patientId);

  if (patientError) {
    return { success: false, error: "Sessão criada, mas houve erro ao ativar o paciente." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}
