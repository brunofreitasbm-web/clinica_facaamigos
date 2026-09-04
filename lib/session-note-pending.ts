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
