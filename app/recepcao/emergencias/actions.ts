"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { GRID_EXCLUDED_STATUSES } from "@/app/supervisao/grade-data";
import { EMERGENCY_MESSAGE_TEMPLATE, buildEmergencyMessage, createEmergencyVoiceCall } from "@/lib/twilio-voice";

export type EmergencyShift = "manha" | "tarde";

export interface AffectedAppointment {
  appointmentId: string;
  patientId: string;
  patientName: string;
  guardianId: string | null;
  guardianPhone: string | null;
  startsAt: string;
  timeLabel: string;
}

type GuardianRow = {
  id: string;
  full_name: string;
  phone: string;
  is_emergency_contact: boolean;
  is_financial: boolean;
};

const timeLabel = (isoInstant: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoInstant));

function shiftBounds(date: string, shift: EmergencyShift): { start: string; end: string } {
  if (shift === "manha") {
    return {
      start: zonedDateTimeToUtc(date, "00:00", CLINIC_TIMEZONE).toISOString(),
      end: zonedDateTimeToUtc(date, "12:00", CLINIC_TIMEZONE).toISOString(),
    };
  }
  return {
    start: zonedDateTimeToUtc(date, "12:00", CLINIC_TIMEZONE).toISOString(),
    end: zonedDateTimeToUtc(date, "23:59", CLINIC_TIMEZONE).toISOString(),
  };
}

/**
 * Lista as sessões de um terapeuta, numa data e turno, ainda não canceladas
 * — as afetadas por uma falta de última hora e candidatas ao disparo de
 * chamadas de emergência.
 */
export async function loadAffectedAppointments(
  therapistId: string,
  date: string,
  shift: EmergencyShift,
): Promise<AffectedAppointment[]> {
  const supabase = await createClient();
  const { start, end } = shiftBounds(date, shift);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      `id, patient_id, starts_at, status,
       patients ( full_name ),
       guardians:guardians!guardians_patient_id_fkey ( id, full_name, phone, is_emergency_contact, is_financial )`,
    )
    .eq("therapist_id", therapistId)
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at", { ascending: true });

  if (error || !appointments) return [];

  return appointments
    .filter((a) => !GRID_EXCLUDED_STATUSES.includes(a.status))
    .map((a) => {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const guardiansList = (a.guardians ?? []) as unknown as GuardianRow[] | null;
      const guardian =
        guardiansList?.find((g) => g.is_emergency_contact) ??
        guardiansList?.find((g) => g.is_financial) ??
        guardiansList?.[0] ??
        null;

      return {
        appointmentId: a.id,
        patientId: a.patient_id,
        patientName: patient?.full_name ?? "—",
        guardianId: guardian?.id ?? null,
        guardianPhone: guardian?.phone ?? null,
        startsAt: a.starts_at,
        timeLabel: timeLabel(a.starts_at),
      };
    });
}

export type DispatchEmergencyCallsResult =
  | { success: true; broadcastId: string; dispatched: number; skipped: number }
  | { success: false; error: string };

/**
 * Central de Chamadas de Emergência por Voz: registra um disparo
 * (voice_emergency_broadcasts) e uma linha de acompanhamento por paciente
 * afetado (voice_emergency_logs), e efetivamente disca via Twilio Voice para
 * cada um. O reagendamento/fallback fica por conta do webhook de status
 * (app/api/twilio/voice/status/route.ts).
 */
export async function dispatchEmergencyCalls(input: {
  therapistId: string;
  occurrenceDate: string;
  shift: EmergencyShift;
  appointmentIds: string[];
}): Promise<DispatchEmergencyCallsResult> {
  const { therapistId, occurrenceDate, shift, appointmentIds } = input;
  if (appointmentIds.length === 0) {
    return { success: false, error: "Selecione ao menos um paciente afetado." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login novamente." };

  const { data: broadcast, error: broadcastError } = await supabase
    .from("voice_emergency_broadcasts")
    .insert({
      supervisor_id: user.id,
      therapist_id: therapistId,
      occurrence_date: occurrenceDate,
      shift,
      message_template: EMERGENCY_MESSAGE_TEMPLATE,
    })
    .select("id")
    .single();

  if (broadcastError || !broadcast) {
    return { success: false, error: "Não foi possível registrar o disparo de emergência." };
  }

  const affected = await loadAffectedAppointmentsByIds(supabase, appointmentIds);

  let dispatched = 0;
  let skipped = 0;
  const admin = createAdminClient();

  for (const appt of affected) {
    if (!appt.guardianPhone) {
      skipped += 1;
      continue;
    }

    const { data: log, error: logError } = await supabase
      .from("voice_emergency_logs")
      .insert({
        broadcast_id: broadcast.id,
        patient_id: appt.patientId,
        guardian_id: appt.guardianId,
        phone_number: appt.guardianPhone,
      })
      .select("id")
      .single();

    if (logError || !log) {
      skipped += 1;
      continue;
    }

    const callResult = await createEmergencyVoiceCall({
      to: appt.guardianPhone,
      logId: log.id,
      patientName: appt.patientName,
      time: appt.timeLabel,
    });

    if (callResult.success && callResult.callSid) {
      // Sem policy de update para papéis de aplicação em voice_emergency_logs
      // (só o webhook via admin client escreve nela depois do insert
      // inicial) — usamos o admin client aqui também, pelo mesmo motivo.
      await admin
        .from("voice_emergency_logs")
        .update({ call_sid: callResult.callSid })
        .eq("id", log.id);
      dispatched += 1;
    } else {
      skipped += 1;
    }
  }

  return { success: true, broadcastId: broadcast.id, dispatched, skipped };
}

async function loadAffectedAppointmentsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentIds: string[],
): Promise<AffectedAppointment[]> {
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      `id, patient_id, starts_at,
       patients ( full_name ),
       guardians:guardians!guardians_patient_id_fkey ( id, full_name, phone, is_emergency_contact, is_financial )`,
    )
    .in("id", appointmentIds);

  if (error || !appointments) return [];

  return appointments.map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const guardiansList = (a.guardians ?? []) as unknown as GuardianRow[] | null;
    const guardian =
      guardiansList?.find((g) => g.is_emergency_contact) ??
      guardiansList?.find((g) => g.is_financial) ??
      guardiansList?.[0] ??
      null;

    return {
      appointmentId: a.id,
      patientId: a.patient_id,
      patientName: patient?.full_name ?? "—",
      guardianId: guardian?.id ?? null,
      guardianPhone: guardian?.phone ?? null,
      startsAt: a.starts_at,
      timeLabel: timeLabel(a.starts_at),
    };
  });
}

export { buildEmergencyMessage };
