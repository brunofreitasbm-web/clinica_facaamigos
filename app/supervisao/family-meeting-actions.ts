"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { formatE164Phone, sendTwilioWhatsApp, getTwilioContentSidForCategory } from "@/lib/twilio";
import { sendFamilyMeetingConfirmationNotification } from "@/lib/family-meeting-confirmation";

type ActionResult = { success: true } | { success: false; error: string };
type Supa = Awaited<ReturnType<typeof createClient>>;

/** "Marcar reunião" (Caixa de entrada) só pode ser operado por quem coordena o atendimento à família. */
async function requireSupervisorOrGestor(supabase: Supa): Promise<ActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "supervisor" && profile?.role !== "gestor") {
    return { success: false, error: "Apenas Supervisão/Gestão pode marcar reunião com responsável." };
  }
  return { success: true };
}

/** Marca o chamado original como tratado — mesma semântica de resolveMessage (inbox-actions.ts). */
async function resolveOriginalMessage(supabase: Supa, messageId: string) {
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", messageId).eq("direction", "inbound");
}

export async function getSupervisorsAction(): Promise<
  { success: true; supervisors: { id: string; name: string }[] } | { success: false; error: string }
> {
  const supabase = await createClient();
  const gate = await requireSupervisorOrGestor(supabase);
  if (!gate.success) return gate;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "supervisor")
    .order("full_name");

  return { success: true, supervisors: (data ?? []).map((p) => ({ id: p.id, name: p.full_name })) };
}

/**
 * Telefone do responsável de um paciente, preferindo o financeiro — mesma
 * regra de lib/evaluation-confirmation.ts. Usa admin client porque a leitura
 * direta de `guardians.phone` pela Supervisão não é coberta pela RLS padrão.
 */
export async function getGuardianPhoneAction(
  patientId: string,
): Promise<{ success: true; phone: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const gate = await requireSupervisorOrGestor(supabase);
  if (!gate.success) return gate;

  const admin = createAdminClient();
  const { data: guardians } = await admin.from("guardians").select("phone, is_financial").eq("patient_id", patientId);
  const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
  const phone = formatE164Phone(guardian?.phone ?? "");
  if (!phone) return { success: false, error: "Nenhum telefone de responsável cadastrado para este paciente." };

  return { success: true, phone };
}

/** Opção 1 do modal "Marcar reunião": WhatsApp manual/freeform (dentro da janela de 24h de serviço). */
export async function sendManualWhatsAppAction(params: {
  messageId: string;
  patientId: string;
  guardianId: string | null;
  phone: string;
  body: string;
}): Promise<ActionResult> {
  const text = params.body.trim();
  if (!text) return { success: false, error: "Escreva a mensagem antes de enviar." };

  const supabase = await createClient();
  const gate = await requireSupervisorOrGestor(supabase);
  if (!gate.success) return gate;

  const result = await sendTwilioWhatsApp({ to: params.phone, message: text });
  if (!result.success) return { success: false, error: result.error ?? "Não foi possível enviar a mensagem via WhatsApp." };

  await supabase.from("messages").insert({
    patient_id: params.patientId,
    guardian_id: params.guardianId,
    channel: "whatsapp",
    direction: "outbound",
    body: text,
    sent_at: new Date().toISOString(),
  });
  await resolveOriginalMessage(supabase, params.messageId);

  revalidatePath("/supervisao");
  return { success: true };
}

/** Opção 2 do modal "Marcar reunião": template aprovado via Twilio Content API (fora da janela de 24h). */
export async function sendTemplateWhatsAppAction(params: {
  messageId: string;
  patientId: string;
  guardianId: string | null;
  phone: string;
  patientName: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const gate = await requireSupervisorOrGestor(supabase);
  if (!gate.success) return gate;

  const contentSid = getTwilioContentSidForCategory("reuniao_responsavel");
  if (!contentSid) {
    return { success: false, error: "Nenhum template aprovado configurado para convite de reunião (TWILIO_MEETING_TEMPLATE_CONTENT_SID)." };
  }

  const fallbackBody = `Convite de reunião sobre o acompanhamento de ${params.patientName} enviado via template Twilio.`;
  const result = await sendTwilioWhatsApp({
    to: params.phone,
    message: fallbackBody,
    contentSid,
    contentVariables: { "1": "Responsável", "2": params.patientName, "3": "FaçaAmigos" },
  });
  if (!result.success) return { success: false, error: result.error ?? "Não foi possível enviar o template via WhatsApp." };

  await supabase.from("messages").insert({
    patient_id: params.patientId,
    guardian_id: params.guardianId,
    channel: "whatsapp",
    direction: "outbound",
    body: fallbackBody,
    sent_at: new Date().toISOString(),
  });
  await resolveOriginalMessage(supabase, params.messageId);

  revalidatePath("/supervisao");
  return { success: true };
}

/** Opção 3 do modal "Marcar reunião": escolhe supervisor + horário e cria o compromisso na agenda de 1ª avaliação. */
export async function bookFamilyMeetingAction(params: {
  messageId: string;
  patientId: string;
  supervisorId: string;
  roomId: string;
  date: string;
  time: string;
  durationMinutes?: number;
}): Promise<ActionResult> {
  if (!params.supervisorId || !params.roomId || !params.date || !params.time) {
    return { success: false, error: "Selecione supervisor, sala, data e hora antes de confirmar." };
  }

  const supabase = await createClient();
  const gate = await requireSupervisorOrGestor(supabase);
  if (!gate.success) return gate;

  const durationMinutes = params.durationMinutes ?? 30;
  const startsAt = zonedDateTimeToUtc(params.date, params.time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const { error } = await supabase.from("appointments").insert({
    patient_id: params.patientId,
    therapist_id: params.supervisorId,
    room_id: params.roomId,
    discipline: "reuniao_responsavel",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    is_evaluation: false,
    is_family_meeting: true,
    // Reunião não tem guia/autorização de convênio — mesma convenção de
    // scheduleEvaluation (não bloqueia o guard de check-out em
    // appointments_authorization_guard).
    is_provisional: true,
  });

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Sala ou supervisor já tem outro compromisso nesse horário." };
    }
    return { success: false, error: "Não foi possível marcar a reunião." };
  }

  await resolveOriginalMessage(supabase, params.messageId);

  await sendFamilyMeetingConfirmationNotification({
    patientId: params.patientId,
    supervisorId: params.supervisorId,
    date: params.date,
    time: params.time,
  });

  revalidatePath("/supervisao");
  return { success: true };
}
