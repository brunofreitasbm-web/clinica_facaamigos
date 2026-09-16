"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { zonedDateTimeToUtc, civilDateInTimeZone, civilTimeInTimeZone } from "@/lib/timezone";
import { sendPatientFeedbackConfirmationNotification } from "@/lib/patient-feedback-confirmation";
import { filterEvaluationRooms } from "@/lib/evaluation-agenda";
import { GRID_EXCLUDED_STATUSES } from "@/lib/appointment-status-style";

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

/** Sala de avaliação (prioriza salas com is_evaluation_room ou nome "avalia", com fallback pras salas ativas da clínica). */
export async function getEvaluationRoomsForFeedbackAction(): Promise<
  { success: true; rooms: { id: string; name: string }[] } | { success: false; error: string }
> {
  const supabase = await createClient();
  const gate = await requireSupervisor(supabase);
  if (!gate.success) return gate;

  const { data } = await supabase
    .from("rooms")
    .select("id, name, is_evaluation_room")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("name");

  const roomsList = data ?? [];
  const filtered = filterEvaluationRooms(roomsList);
  const rooms = filtered.length > 0 ? filtered : roomsList;

  return { success: true, rooms: rooms.map((r) => ({ id: r.id, name: r.name })) };
}

/** Busca detalhes da 1ª avaliação do paciente (para obter a sala e horário onde foi avaliado). */
export async function getPatientEvaluationDetailsAction(patientId: string): Promise<
  | {
      success: true;
      evaluationInfo: {
        roomId: string;
        roomName: string;
        date: string;
        time: string;
      } | null;
    }
  | { success: false; error: string }
> {
  if (!patientId) return { success: true, evaluationInfo: null };

  const supabase = await createClient();
  const gate = await requireSupervisor(supabase);
  if (!gate.success) return gate;

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, room_id, starts_at, rooms(id, name)")
    .eq("patient_id", patientId)
    .eq("is_evaluation", true)
    .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!appt || !appt.room_id) {
    return { success: true, evaluationInfo: null };
  }

  const room = Array.isArray(appt.rooms) ? appt.rooms[0] : appt.rooms;
  const startsAt = appt.starts_at ? new Date(appt.starts_at) : null;

  return {
    success: true,
    evaluationInfo: {
      roomId: appt.room_id,
      roomName: room?.name ?? "Sala de avaliação",
      date: startsAt ? civilDateInTimeZone(startsAt, CLINIC_TIMEZONE) : "",
      time: appt.starts_at ? civilTimeInTimeZone(appt.starts_at, CLINIC_TIMEZONE) : "",
    },
  };
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
    .maybeSingle();
  if (!room) {
    return { success: false, error: "Sala de avaliação selecionada não encontrada." };
  }

  const durationMinutes = params.durationMinutes ?? 30;
  const startsAt = zonedDateTimeToUtc(params.date, params.time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  // Verificação de conflito/sobreposição de horário na sala de avaliação ou supervisor
  const { data: overlapping } = await supabase
    .from("appointments")
    .select("id, is_evaluation")
    .or(`room_id.eq.${params.roomId},therapist_id.eq.${supervisorId}`)
    .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());

  if (overlapping && overlapping.length > 0) {
    const isEvalConflict = overlapping.some((a) => a.is_evaluation);
    if (isEvalConflict) {
      return {
        success: false,
        error: "Conflito de agendamento: este dia e horário já possui uma 1ª avaliação agendada nessa sala.",
      };
    }
    return {
      success: false,
      error: "A sala de avaliação ou o supervisor já possui outro compromisso agendado nesse dia e horário.",
    };
  }

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

