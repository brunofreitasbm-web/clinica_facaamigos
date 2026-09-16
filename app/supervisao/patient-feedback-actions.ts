"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { sendPatientFeedbackConfirmationNotification } from "@/lib/patient-feedback-confirmation";

type ActionResult = { success: true } | { success: false; error: string };
type Supa = Awaited<ReturnType<typeof createClient>>;

/** Devolutiva do paciente com os pais é agenda exclusiva da Supervisão — só quem coordena decide data/sala. */
async function requireSupervisor(supabase: Supa): Promise<ActionResult & { userId?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "supervisor") {
    return { success: false, error: "Apenas a Supervisão pode marcar devolutiva do paciente." };
  }
  return { success: true, userId: user.id };
}

export async function getActivePatientsForFeedbackAction(): Promise<
  { success: true; patients: { id: string; name: string }[] } | { success: false; error: string }
> {
  const supabase = await createClient();
  const gate = await requireSupervisor(supabase);
  if (!gate.success) return gate;

  const { data } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .in("status", ["ativo", "pausado", "avaliacao"])
    .order("full_name");

  return { success: true, patients: (data ?? []).map((p) => ({ id: p.id, name: p.full_name })) };
}

/** Sala específica de avaliação (rooms.is_evaluation_room) — devolutiva sempre acontece lá. */
export async function getEvaluationRoomsForFeedbackAction(): Promise<
  { success: true; rooms: { id: string; name: string }[] } | { success: false; error: string }
> {
  const supabase = await createClient();
  const gate = await requireSupervisor(supabase);
  if (!gate.success) return gate;

  const { data } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("is_evaluation_room", true)
    .order("name");

  return { success: true, rooms: (data ?? []).map((r) => ({ id: r.id, name: r.name })) };
}

/** Cadastra a devolutiva na agenda de 1ª avaliação e avisa a família na hora, com data/horário já definidos. */
export async function bookPatientFeedbackAction(params: {
  patientId: string;
  roomId: string;
  date: string;
  time: string;
  durationMinutes?: number;
}): Promise<ActionResult> {
  if (!params.patientId || !params.roomId || !params.date || !params.time) {
    return { success: false, error: "Selecione paciente, sala, data e hora antes de confirmar." };
  }

  const supabase = await createClient();
  const gate = await requireSupervisor(supabase);
  if (!gate.success) return gate;
  const supervisorId = gate.userId!;

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", params.roomId)
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("is_evaluation_room", true)
    .maybeSingle();
  if (!room) {
    return { success: false, error: "Devolutiva só pode ser marcada na sala de avaliação." };
  }

  const durationMinutes = params.durationMinutes ?? 30;
  const startsAt = zonedDateTimeToUtc(params.date, params.time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const { error } = await supabase.from("appointments").insert({
    patient_id: params.patientId,
    therapist_id: supervisorId,
    room_id: params.roomId,
    discipline: "devolutiva_paciente",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "agendada",
    is_evaluation: false,
    is_family_meeting: false,
    is_patient_feedback: true,
    // Devolutiva não tem guia/autorização de convênio — mesma convenção de
    // bookFamilyMeetingAction (não bloqueia o guard de check-out em
    // appointments_authorization_guard).
    is_provisional: true,
  });

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Sala ou supervisor já tem outro compromisso nesse horário." };
    }
    return { success: false, error: "Não foi possível marcar a devolutiva." };
  }

  await sendPatientFeedbackConfirmationNotification({
    patientId: params.patientId,
    supervisorId,
    roomId: params.roomId,
    date: params.date,
    time: params.time,
  });

  revalidatePath("/supervisao");
  return { success: true };
}
