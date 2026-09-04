import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Conta sessões `realizada` há mais de `hoursThreshold` horas cuja evolução
 * ainda está pendente. Delega a checagem por sessão à RPC `session_note_pending`
 * (já valida `status='realizada'` e escopo de clínica via RLS no banco —
 * ver supabase/migrations/20260904000015_profiles_admin_and_scope_fixes.sql).
 *
 * Usada tanto na home da coordenação clínica ("Evoluções atrasadas") quanto
 * na do faturamento ("Sessões sem evolução") — mesma regra de negócio, sem
 * filtro de papel/terapeuta: a RLS de cada papel decide o que a pessoa
 * enxerga em `appointments`.
 */
export async function countOverdueSessionNotes(
  supabase: SupabaseClient<Database>,
  hoursThreshold = 24,
): Promise<number> {
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();

  const { data: candidates } = await supabase
    .from("appointments")
    .select("id")
    .eq("status", "realizada")
    .lte("starts_at", cutoff);

  let overdue = 0;
  for (const appointment of candidates ?? []) {
    const { data: isPending } = await supabase.rpc("session_note_pending", {
      p_appointment_id: appointment.id,
    });
    if (isPending) overdue += 1;
  }
  return overdue;
}

export type OverdueSessionNote = {
  appointmentId: string;
  therapistId: string;
  therapistName: string;
  patientName: string;
  startsAt: string;
  hoursOverdue: number;
};

/**
 * Mesma regra de `countOverdueSessionNotes` (sessão `realizada` há mais de
 * `hoursThreshold` horas sem `session_notes`), mas devolvendo a lista
 * detalhada — terapeuta, paciente, quantas horas além do prazo — para o
 * painel de supervisão ("Pendências da equipe" na aba Grade). Mantida como
 * função separada (não uma refatoração de `countOverdueSessionNotes`) para
 * não arriscar a query mais simples já usada pela home de faturamento: o
 * embed de `profiles`/`patients` aqui depende de RLS de leitura nessas
 * tabelas, que nem todo papel chamador de `countOverdueSessionNotes` tem.
 */
export async function listOverdueSessionNotes(
  supabase: SupabaseClient<Database>,
  hoursThreshold = 24,
): Promise<OverdueSessionNote[]> {
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();

  const { data: candidates } = await supabase
    .from("appointments")
    .select("id, starts_at, therapist_id, profiles!therapist_id(full_name), patients(full_name)")
    .eq("status", "realizada")
    .lte("starts_at", cutoff)
    .order("starts_at", { ascending: true });

  const overdue: OverdueSessionNote[] = [];
  for (const appointment of candidates ?? []) {
    const { data: isPending } = await supabase.rpc("session_note_pending", {
      p_appointment_id: appointment.id,
    });
    if (!isPending) continue;

    const therapist = Array.isArray(appointment.profiles) ? appointment.profiles[0] : appointment.profiles;
    const patient = Array.isArray(appointment.patients) ? appointment.patients[0] : appointment.patients;
    const hoursSinceSession = Math.floor(
      (Date.now() - new Date(appointment.starts_at).getTime()) / (60 * 60 * 1000),
    );

    overdue.push({
      appointmentId: appointment.id,
      therapistId: appointment.therapist_id,
      therapistName: therapist?.full_name ?? "—",
      patientName: patient?.full_name ?? "—",
      startsAt: appointment.starts_at,
      hoursOverdue: Math.max(0, hoursSinceSession - hoursThreshold),
    });
  }
  return overdue;
}
