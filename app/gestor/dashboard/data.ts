import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";
import { currentMonthRange, hoursBetween } from "../data";

type Supa = SupabaseClient<Database>;

export type StatusBar = { status: string; label: string; tagClass: string; count: number };
export type DayBar = { label: string; date: string; count: number; isToday: boolean };
export type RoomBar = { label: string; hours: number };
export type TherapistSlaBar = { label: string; ratePct: number | null; realized: number };

export type DashboardMetrics = {
  activePatients: number;
  therapistsUnderContract: number;
  sessionsThisMonth: number;
  roomOccupancyPct: number | null;
  nps: number | null;
  statusBars: StatusBar[];
  dailyVolume: DayBar[];
  roomBars: RoomBar[];
  slaBars: TherapistSlaBar[];
};

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function getDashboardMetrics(supabase: Supa, clinicId: string): Promise<DashboardMetrics> {
  const { startISO, endISO } = currentMonthRange();

  const [{ count: activePatients }, { data: contracts }, { data: monthAppointments }, { data: rooms }] =
    await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "ativo"),
      supabase
        .from("therapist_contracts")
        .select("profile_id, valid_from, valid_to, profiles!inner(clinic_id)")
        .eq("profiles.clinic_id", clinicId)
        .is("valid_to", null),
      supabase
        .from("appointments")
        .select("id, status, room_id, therapist_id, starts_at, ends_at, patients!inner(clinic_id)")
        .eq("patients.clinic_id", clinicId)
        .gte("starts_at", startISO)
        .lt("starts_at", endISO),
      supabase.from("rooms").select("id, name").eq("clinic_id", clinicId).order("name"),
    ]);

  const monthList = monthAppointments ?? [];
  const roomList = rooms ?? [];

  // Sessões por status · mês
  const statusCounts = new Map<string, number>();
  for (const a of monthList) statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
  const statusBars: StatusBar[] = Object.entries(APPOINTMENT_STATUS_STYLE)
    .map(([status, style]) => ({ status, label: style.label, tagClass: style.tagClass, count: statusCounts.get(status) ?? 0 }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

  // Volume diário · última semana (domingo a sábado, hoje destacado)
  const today = new Date();
  const dailyVolume: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    dailyVolume.push({
      label: WEEKDAY_LABEL[day.getUTCDay()],
      date: day.toISOString(),
      count: 0, // preenchido abaixo com uma única query em lote pra semana inteira
      isToday: i === 0,
    });
  }
  const weekStartISO = dailyVolume[0]!.date;
  const weekEndISO = new Date(new Date(dailyVolume[dailyVolume.length - 1]!.date).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: weekAppointments } = await supabase
    .from("appointments")
    .select("starts_at, patients!inner(clinic_id)")
    .eq("patients.clinic_id", clinicId)
    .gte("starts_at", weekStartISO)
    .lt("starts_at", weekEndISO);
  for (const a of weekAppointments ?? []) {
    const d = new Date(a.starts_at);
    const dayKey = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
    const bucket = dailyVolume.find((b) => b.date === dayKey);
    if (bucket) bucket.count += 1;
  }

  // Ocupação por sala (horas de sessão `realizada` no mês, por sala)
  const roomHours = new Map<string, number>();
  for (const a of monthList) {
    if (a.status !== "realizada") continue;
    roomHours.set(a.room_id, (roomHours.get(a.room_id) ?? 0) + hoursBetween(a.starts_at, a.ends_at));
  }
  const roomBars: RoomBar[] = roomList.map((r) => ({ label: r.name, hours: Math.round((roomHours.get(r.id) ?? 0) * 10) / 10 }));

  // % ocupação salas (card do topo) — aproximação explícita: capacidade
  // assumida de 8h úteis/sala/dia em dias úteis já decorridos no mês (não
  // existe tabela de disponibilidade real — availability_slots é Fase 2,
  // ver PRD §7 nota de `room_occupancy`).
  let businessDaysElapsed = 0;
  for (let d = 1; d <= today.getUTCDate(); d++) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), d)).getUTCDay();
    if (day !== 0 && day !== 6) businessDaysElapsed += 1;
  }
  const totalRealizedHours = [...roomHours.values()].reduce((s, h) => s + h, 0);
  const assumedCapacityHours = roomList.length * businessDaysElapsed * 8;
  const roomOccupancyPct =
    assumedCapacityHours > 0 ? Math.min(100, Math.round((totalRealizedHours / assumedCapacityHours) * 100)) : null;

  // SLA de evolução em 24h, por terapeuta (últimos 30 dias)
  const thirtyDaysAgoISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRealized } = await supabase
    .from("appointments")
    .select("id, therapist_id, ends_at, patients!inner(clinic_id)")
    .eq("patients.clinic_id", clinicId)
    .eq("status", "realizada")
    .gte("starts_at", thirtyDaysAgoISO);
  const realizedList = recentRealized ?? [];
  const therapistIds = [...new Set(realizedList.map((r) => r.therapist_id))];
  const { data: therapists } = therapistIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", therapistIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((therapists ?? []).map((t) => [t.id, t.full_name]));

  const noteByAppointment = new Map<string, string>();
  if (realizedList.length > 0) {
    const { data: notes } = await supabase
      .from("session_notes")
      .select("appointment_id, created_at_server")
      .in(
        "appointment_id",
        realizedList.map((r) => r.id),
      );
    for (const n of notes ?? []) {
      const existing = noteByAppointment.get(n.appointment_id);
      if (!existing || new Date(n.created_at_server) < new Date(existing)) noteByAppointment.set(n.appointment_id, n.created_at_server);
    }
  }

  const byTherapist = new Map<string, { onTime: number; total: number }>();
  for (const r of realizedList) {
    const entry = byTherapist.get(r.therapist_id) ?? { onTime: 0, total: 0 };
    entry.total += 1;
    const noteAt = noteByAppointment.get(r.id);
    if (noteAt && new Date(noteAt).getTime() <= new Date(r.ends_at).getTime() + 24 * 60 * 60 * 1000) entry.onTime += 1;
    byTherapist.set(r.therapist_id, entry);
  }
  const slaBars: TherapistSlaBar[] = [...byTherapist.entries()]
    .map(([id, v]) => ({ label: nameById.get(id) ?? "—", ratePct: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : null, realized: v.total }))
    .sort((a, b) => (b.ratePct ?? 0) - (a.ratePct ?? 0));

  // NPS: media de survey_responses.nps_score — sem dado real ainda, mostra "sem dado" em vez de inventar.
  const { data: surveys } = await supabase.from("survey_responses").select("nps_score");
  const scores = (surveys ?? []).map((s) => s.nps_score).filter((s): s is number => s != null);
  const nps = scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

  return {
    activePatients: activePatients ?? 0,
    therapistsUnderContract: new Set((contracts ?? []).map((c) => c.profile_id)).size,
    sessionsThisMonth: monthList.filter((a) => a.status === "realizada").length,
    roomOccupancyPct,
    nps,
    statusBars,
    dailyVolume,
    roomBars,
    slaBars,
  };
}
