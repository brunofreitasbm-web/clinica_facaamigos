import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { GRID_EXCLUDED_STATUSES } from "@/lib/appointment-status-style";
import { civilTimeInTimeZone, nextCalendarDay, todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { buildDoorListRows, type DoorListRow } from "@/lib/evaluation-door-list-pure";

export type EvaluationDoorList = { date: string; rows: DoorListRow[] };

/**
 * Primeiras avaliações do dia (fuso da clínica) para a lista da porta.
 * Fica de fora: devolutiva/reunião de família (não são "primeira avaliação"),
 * horários provisórios (ainda aguardam o OK da Supervisão) e os status que a
 * agenda já esconde (cancelado, faltou...).
 */
export async function getEvaluationDoorList(date = todayInTimeZone(CLINIC_TIMEZONE)): Promise<EvaluationDoorList> {
  const supabase = createAdminClient();
  const startIso = zonedDateTimeToUtc(date, "00:00", CLINIC_TIMEZONE).toISOString();
  const endIso = zonedDateTimeToUtc(nextCalendarDay(date), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data } = await supabase
    .from("appointments")
    .select("starts_at, patient_id, patients(full_name), therapist:profiles!therapist_id(full_name)")
    .eq("is_evaluation", true)
    .eq("is_family_meeting", false)
    .eq("is_patient_feedback", false)
    .eq("is_provisional", false)
    .gte("starts_at", startIso)
    .lt("starts_at", endIso)
    .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`);

  const appointments = data ?? [];
  const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
  const { data: guardians } = patientIds.length
    ? await supabase.from("guardians").select("patient_id, full_name, is_financial").in("patient_id", patientIds)
    : { data: [] as { patient_id: string; full_name: string | null; is_financial: boolean | null }[] };

  // Mesma regra do pool da agenda: o responsável financeiro prevalece, senão o primeiro.
  const guardianByPatient = new Map<string, string | null>();
  const financial = new Set<string>();
  for (const g of guardians ?? []) {
    if (!guardianByPatient.has(g.patient_id) || (g.is_financial && !financial.has(g.patient_id))) {
      guardianByPatient.set(g.patient_id, g.full_name ?? null);
      if (g.is_financial) financial.add(g.patient_id);
    }
  }

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  const rows = buildDoorListRows(
    appointments.map((a) => ({
      time: civilTimeInTimeZone(a.starts_at, CLINIC_TIMEZONE),
      patient: one(a.patients)?.full_name ?? "Paciente",
      guardian: guardianByPatient.get(a.patient_id) ?? null,
      therapist: one(a.therapist)?.full_name ?? "A definir",
    })),
  );
  return { date, rows };
}
