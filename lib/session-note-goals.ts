import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { MetaTrabalhada, SessionNoteStructured } from "@/lib/session-note-fields";
import { SESSION_NOTE_METAS_KEY } from "@/lib/session-note-fields";

export type ActiveGoal = {
  id: string;
  description: string;
  domain: string;
  discipline: string;
};

/**
 * Metas ativas (`plan_goals.status = 'ativa'`) do plano aprovado do
 * paciente — checkbox de "Metas trabalhadas" do formulário de evolução
 * (PRD §9.4). Espelha o filtro de getProgramsForAppointment
 * (lib/trial-data.ts): só plano `aprovado` tem coleta ativa.
 */
export async function getActiveGoalsForPatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<ActiveGoal[]> {
  const { data: plans } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .eq("status", "aprovado");

  const planIds = (plans ?? []).map((p) => p.id);
  if (planIds.length === 0) return [];

  const { data: goals } = await supabase
    .from("plan_goals")
    .select("id, description, domain, discipline")
    .in("treatment_plan_id", planIds)
    .eq("status", "ativa");

  return goals ?? [];
}

/**
 * Metas trabalhadas na última evolução assinada da sessão anterior deste
 * paciente (antes de `beforeAppointmentId`) — usado para pré-marcar o
 * formulário, como o PRD pede ("já vem pré-marcado com as da sessão
 * anterior"). Só olha appointments do próprio paciente, não do mesmo
 * terapeuta: a equipe compartilha o plano.
 */
export async function getPreviousSessionMetaIds(
  supabase: SupabaseClient<Database>,
  patientId: string,
  beforeAppointmentId: string,
): Promise<string[]> {
  const { data: current } = await supabase
    .from("appointments")
    .select("starts_at")
    .eq("id", beforeAppointmentId)
    .maybeSingle();
  if (!current) return [];

  const { data: previousAppointments } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .lt("starts_at", current.starts_at)
    .order("starts_at", { ascending: false })
    .limit(10);

  const ids = (previousAppointments ?? []).map((a) => a.id);
  if (ids.length === 0) return [];

  const { data: notes } = await supabase
    .from("session_notes")
    .select("appointment_id, version, structured, created_at_server")
    .in("appointment_id", ids)
    .not("signed_at", "is", null)
    .order("created_at_server", { ascending: false });

  // A sessão mais recente entre as anteriores, na maior versão (evolução
  // pode ter sido corrigida) — mesma regra usada por family_guidance_feed.
  const byAppointment = new Map<string, { version: number; structured: SessionNoteStructured | null }>();
  for (const n of notes ?? []) {
    const existing = byAppointment.get(n.appointment_id);
    if (!existing || n.version > existing.version) {
      byAppointment.set(n.appointment_id, {
        version: n.version,
        structured: n.structured as SessionNoteStructured | null,
      });
    }
  }

  for (const appointmentId of ids) {
    const note = byAppointment.get(appointmentId);
    if (note) {
      const metas = (note.structured?.[SESSION_NOTE_METAS_KEY] ?? []) as MetaTrabalhada[];
      return metas.map((m) => m.plan_goal_id);
    }
  }

  return [];
}
