// app/recepcao/agenda/coupon-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { todayInTimeZone, zonedDateTimeToUtc, nextCalendarDay } from "@/lib/timezone";
import { NEGATIVE_STATUSES } from "@/lib/appointment-cancel-reasons";
import { evaluateAuthorizationWarning } from "@/lib/authorization-warning";
import {
  buildCouponModel,
  couponSettingsFromRow,
  COUPON_LOGO_PATH,
  type CouponInput,
  type CouponModel,
  type CouponSessionInput,
  type CheckinCouponSettingsRow,
} from "@/lib/checkin-coupon";

// Sessão cancelada/remarcada não entra no roteiro impresso — mesmo conjunto
// de status "fora de disputa" usado em session-actions.ts (NON_ACTIVE_STATUSES).
const EXCLUDED_STATUSES = new Set<string>(NEGATIVE_STATUSES.map((s) => s.value));

type RawAppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  discipline: string;
  status: string;
  checkin_at: string | null;
  is_provisional: boolean;
  is_evaluation: boolean;
  authorization_id: string | null;
  rooms: { name: string } | null;
  therapist: { full_name: string } | null;
  patients: { full_name: string } | null;
  authorizations: {
    status: string;
    valid_from: string;
    valid_to: string;
    sessions_used: number;
    sessions_authorized: number;
    password_valid_until: string | null;
  } | null;
};

/**
 * Monta o modelo do cupom para um paciente num dia específico. Não exportada
 * — chamada tanto por `getCheckinCoupon` (reimpressão manual) quanto por
 * `maybeBuildCheckinCoupon` (gatilho automático no primeiro check-in), que
 * fica ao lado de `checkIn()` em session-actions.ts.
 *
 * `logoUrl` é montado no client (srcdoc não resolve caminho relativo) — aqui
 * fica `null`; quem chama pela UI injeta a URL absoluta antes de imprimir.
 */
export async function buildCouponForPatientDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  day: string,
): Promise<CouponModel | null> {
  const dayStart = zonedDateTimeToUtc(day, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(day), "00:00", CLINIC_TIMEZONE).toISOString();

  const [settingsResult, clinicResult, appointmentsResult, specialtiesResult, ticketResult] = await Promise.all([
    supabase.from("checkin_coupon_settings").select("*").eq("clinic_id", DEV_CLINIC_ID).maybeSingle(),
    supabase.from("clinics").select("name").eq("id", DEV_CLINIC_ID).maybeSingle(),
    // `therapist:profiles!therapist_id` é obrigatório: appointments tem duas
    // FKs pra profiles (therapist_id e cancelled_by) — mesmo padrão de
    // app/recepcao/page.tsx.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("appointments")
      .select(
        "id, starts_at, ends_at, discipline, status, checkin_at, is_provisional, is_evaluation, authorization_id, rooms(name), therapist:profiles!therapist_id(full_name), patients(full_name), authorizations(status, valid_from, valid_to, sessions_used, sessions_authorized, password_valid_until)",
      )
      .eq("patient_id", patientId)
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd)
      .order("starts_at", { ascending: true }),
    supabase.from("specialties").select("value, label").eq("clinic_id", DEV_CLINIC_ID).eq("active", true),
    supabase
      .from("checkin_requests")
      .select("ticket_label")
      .eq("patient_id", patientId)
      .eq("service_date", day)
      .not("ticket_label", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const settings = couponSettingsFromRow(settingsResult.data as CheckinCouponSettingsRow | null);

  const rawAppointments = (appointmentsResult.data ?? []) as unknown as RawAppointmentRow[];
  const activeAppointments = rawAppointments.filter((a) => !EXCLUDED_STATUSES.has(a.status));
  if (activeAppointments.length === 0) return null;

  const disciplineLabels = new Map<string, string>();
  for (const s of specialtiesResult.data ?? []) {
    disciplineLabels.set(s.value, s.label);
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const sessions: CouponSessionInput[] = activeAppointments.map((a) => {
    const authorization = a.authorizations
      ? {
          status: a.authorizations.status,
          validFrom: a.authorizations.valid_from,
          validTo: a.authorizations.valid_to,
          sessionsUsed: a.authorizations.sessions_used,
          sessionsAuthorized: a.authorizations.sessions_authorized,
          passwordValidUntil: a.authorizations.password_valid_until,
        }
      : null;
    const warning = evaluateAuthorizationWarning(
      {
        authorizationId: a.authorization_id,
        isProvisional: a.is_provisional,
        isEvaluation: a.is_evaluation,
        authorization,
      },
      today,
    );
    return {
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      roomName: a.rooms?.name ?? "",
      disciplineLabel: disciplineLabels.get(a.discipline) ?? a.discipline,
      therapistName: a.therapist?.full_name ?? "",
      warning,
    };
  });

  const patientName = activeAppointments[0]?.patients?.full_name ?? "";
  const checkinAt = rawAppointments.find((a) => a.checkin_at)?.checkin_at ?? null;

  const input: CouponInput = {
    clinicName: clinicResult.data?.name ?? "",
    patientName,
    serviceDate: day,
    checkinAt,
    ticketLabel: ticketResult.data?.ticket_label ?? null,
    printedAt: new Date().toISOString(),
    logoUrl: COUPON_LOGO_PATH,
    sessions,
  };

  return buildCouponModel(input, settings, CLINIC_TIMEZONE);
}

/**
 * Reimpressão manual, sempre que a recepção clica "Reimprimir cupom" — ao
 * contrário do gatilho automático, ignora `enabled`/`triggerMode` (é uma
 * ação explícita da recepcionista) mas ainda respeita largura e toggles de
 * campo das settings.
 */
export async function getCheckinCoupon(
  patientId: string,
  serviceDate?: string,
): Promise<{ success: true; coupon: CouponModel } | { success: false; error: string }> {
  const supabase = await createClient();
  const day = serviceDate ?? todayInTimeZone(CLINIC_TIMEZONE);

  try {
    const coupon = await buildCouponForPatientDay(supabase, patientId, day);
    if (!coupon) {
      return { success: false, error: "Nenhuma sessão encontrada para esse paciente hoje." };
    }
    return { success: true, coupon };
  } catch (err) {
    console.error("[getCheckinCoupon] erro ao montar cupom:", err);
    return { success: false, error: "Não foi possível montar o cupom. Tente de novo." };
  }
}

/**
 * Gatilho automático chamado de dentro de `checkIn()` (session-actions.ts),
 * logo após o `update` de `checkin_at` ter sido gravado com sucesso. Nunca
 * lança — falhar em montar o cupom não pode derrubar o check-in em si,
 * mesmo espírito de `notifyTherapistOfFirstCheckIn`.
 */
export async function maybeBuildCheckinCoupon(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string,
): Promise<CouponModel | null> {
  try {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("patient_id, starts_at")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appointment) return null;

    const { data: settingsRow } = await supabase
      .from("checkin_coupon_settings")
      .select("*")
      .eq("clinic_id", DEV_CLINIC_ID)
      .maybeSingle();
    const settings = couponSettingsFromRow(settingsRow as CheckinCouponSettingsRow | null);

    if (!settings.enabled || settings.triggerMode === "manual") return null;

    const day = todayInTimeZone(CLINIC_TIMEZONE);

    if (settings.triggerMode === "primeiro") {
      const dayStart = zonedDateTimeToUtc(day, "00:00", CLINIC_TIMEZONE).toISOString();
      const dayEnd = zonedDateTimeToUtc(nextCalendarDay(day), "00:00", CLINIC_TIMEZONE).toISOString();
      // O update de checkin_at já foi gravado antes desta chamada — se a
      // contagem der 1, esta é a primeira sessão do paciente com check-in hoje.
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", appointment.patient_id)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
        .not("checkin_at", "is", null);
      if ((count ?? 0) !== 1) return null;
    }

    return await buildCouponForPatientDay(supabase, appointment.patient_id, day);
  } catch (err) {
    console.error("[maybeBuildCheckinCoupon] erro ao montar cupom automático:", err);
    return null;
  }
}
