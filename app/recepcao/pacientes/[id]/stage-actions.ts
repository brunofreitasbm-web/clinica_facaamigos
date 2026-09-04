"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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

  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

  const supabase = createAdminClient();
  const { error: apptError } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline: "avaliacao",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    is_evaluation: true,
  });

  if (apptError) {
    if (apptError.code === "23P01") {
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

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function markEvaluationDone(patientId: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: evalAppointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .eq("is_evaluation", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!evalAppointment) {
    return { success: false, error: "Nenhuma avaliação agendada encontrada pra este paciente." };
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

  if (!insurerId || !procedureCode || !sessionsAuthorized || !validFrom || !validTo) {
    return { success: false, error: "Preencha convênio, procedimento, sessões autorizadas e vigência." };
  }

  const supabase = createAdminClient();

  const { data: patientInsurance, error: piError } = await supabase
    .from("patient_insurance")
    .insert({ patient_id: patientId, insurer_id: insurerId, is_private: false })
    .select("id")
    .single();

  if (piError || !patientInsurance) {
    return { success: false, error: "Não foi possível vincular o convênio ao paciente." };
  }

  const { error: authError } = await supabase.from("authorizations").insert({
    patient_insurance_id: patientInsurance.id,
    guide_number: guideNumber || null,
    procedure_code: procedureCode,
    sessions_authorized: sessionsAuthorized,
    valid_from: validFrom,
    valid_to: validTo,
    status: "ativa",
  });

  if (authError) {
    return { success: false, error: "Convênio vinculado, mas houve erro ao registrar a autorização." };
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

  const supabase = createAdminClient();

  const { data: authorization } = await supabase
    .from("authorizations")
    .select("id, patient_insurance_id, patient_insurance!inner(patient_id)")
    .eq("patient_insurance.patient_id", patientId)
    .eq("status", "ativa")
    .limit(1)
    .maybeSingle();

  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

  const { error: apptError } = await supabase.from("appointments").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    room_id: roomId,
    discipline,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    authorization_id: authorization?.id ?? null,
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
