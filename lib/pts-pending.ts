import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Prazo interno de PTS (Boaspraticas.md §2.3: "Prazo interno para PDI: 50
 * dias"), contado da 1ª avaliação (anamnese) — mesma âncora já usada para o prazo de 60
 * dias da devolutiva à família (trg_anamneses_after_insert em
 * supabase/migrations/20260906000001_intake_journey.sql), então os dois
 * prazos do §2.3 ficam medidos a partir do mesmo evento.
 */
export const PTS_DEADLINE_DAYS = 50;

// Pacientes fora do fluxo ativo de PTS não geram alerta de atraso.
const PTS_EXCLUDED_PATIENT_STATUSES = ["evadido", "alta"];

async function overduePlanCandidates(supabase: SupabaseClient<Database>, thresholdDays: number) {
  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: anamneses } = await supabase
    .from("anamneses")
    .select("patient_id, conducted_at, patients(full_name, status)")
    .order("conducted_at", { ascending: true });

  const earliestByPatient = new Map<string, { conductedAt: string; patientName: string }>();
  for (const a of anamneses ?? []) {
    if (earliestByPatient.has(a.patient_id)) continue; // já guardou a anamnese mais antiga
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    if (!patient || PTS_EXCLUDED_PATIENT_STATUSES.includes(patient.status)) continue;
    earliestByPatient.set(a.patient_id, { conductedAt: a.conducted_at, patientName: patient.full_name });
  }

  const overdueCandidates = Array.from(earliestByPatient.entries()).filter(([, v]) => v.conductedAt <= cutoff);
  if (overdueCandidates.length === 0) return [];

  const { data: approvedPlans } = await supabase
    .from("treatment_plans")
    .select("patient_id")
    .in(
      "patient_id",
      overdueCandidates.map(([patientId]) => patientId),
    )
    .not("approved_by", "is", null);

  const approvedPatientIds = new Set((approvedPlans ?? []).map((p) => p.patient_id));

  return overdueCandidates.filter(([patientId]) => !approvedPatientIds.has(patientId));
}

/**
 * Conta pacientes cuja anamnese passou de `thresholdDays` dias sem nenhum
 * treatment_plan aprovado pela supervisão (approved_by preenchido).
 */
export async function countOverduePlans(
  supabase: SupabaseClient<Database>,
  thresholdDays = PTS_DEADLINE_DAYS,
): Promise<number> {
  return (await overduePlanCandidates(supabase, thresholdDays)).length;
}

export type OverduePlan = {
  patientId: string;
  patientName: string;
  conductedAt: string;
  daysOverdue: number;
};

/**
 * Mesma regra de `countOverduePlans`, mas devolvendo a lista detalhada —
 * paciente e há quantos dias além do prazo — para o painel de supervisão
 * ("Pendências da equipe" na aba Grade), no mesmo padrão de
 * `listOverdueSessionNotes` em lib/session-note-pending.ts.
 */
export async function listOverduePlans(
  supabase: SupabaseClient<Database>,
  thresholdDays = PTS_DEADLINE_DAYS,
): Promise<OverduePlan[]> {
  const candidates = await overduePlanCandidates(supabase, thresholdDays);

  return candidates
    .map(([patientId, v]) => {
      const daysSince = Math.floor((Date.now() - new Date(v.conductedAt).getTime()) / (24 * 60 * 60 * 1000));
      return {
        patientId,
        patientName: v.patientName,
        conductedAt: v.conductedAt,
        daysOverdue: Math.max(0, daysSince - thresholdDays),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}
