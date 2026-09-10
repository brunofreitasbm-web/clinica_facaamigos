import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Conta sessões `realizada` há mais de `hoursThreshold` horas cuja evolução
 * ainda está pendente. Resolvido em uma única query agregada pela RPC
 * `count_overdue_session_notes` (mesmo guard de clínica do antigo
 * `session_note_pending`, ver
 * supabase/migrations/20260910100000_batch_overdue_session_notes.sql) —
 * substitui o N+1 anterior (uma RPC por sessão candidata).
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
  const { data } = await supabase.rpc("count_overdue_session_notes", {
    p_hours_threshold: hoursThreshold,
  });
  return data ?? 0;
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
 * painel de supervisão ("Pendências da equipe" na aba Grade). Resolvida em
 * uma única query agregada pela RPC `list_overdue_session_notes` (mesmo
 * SECURITY DEFINER do `session_note_pending` original, então não depende
 * da RLS de leitura de `session_notes`/`profiles` do chamador).
 */
export async function listOverdueSessionNotes(
  supabase: SupabaseClient<Database>,
  hoursThreshold = 24,
): Promise<OverdueSessionNote[]> {
  const { data } = await supabase.rpc("list_overdue_session_notes", {
    p_hours_threshold: hoursThreshold,
  });

  return (data ?? []).map((row) => {
    const hoursSinceSession = Math.floor((Date.now() - new Date(row.starts_at).getTime()) / (60 * 60 * 1000));
    return {
      appointmentId: row.appointment_id,
      therapistId: row.therapist_id,
      therapistName: row.therapist_name ?? "—",
      patientName: row.patient_name ?? "—",
      startsAt: row.starts_at,
      hoursOverdue: Math.max(0, hoursSinceSession - hoursThreshold),
    };
  });
}
