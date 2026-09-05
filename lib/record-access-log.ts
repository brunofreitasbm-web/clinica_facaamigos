import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * LGPD (§11 do PRD): toda leitura de prontuário de paciente (dado sensível
 * de menor) precisa ficar registrada, separado do `audit_log` de escrita.
 * Best-effort: nunca deve derrubar a página por causa de log — usuário demo
 * (sem `auth.uid()`) ou falha de RLS apenas pulam o registro silenciosamente
 * aqui, mas o erro real (se houver) não é a causa de a página não carregar.
 */
export async function logRecordAccess(
  supabase: SupabaseClient<Database>,
  patientId: string,
  reason: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("record_access_log").insert({
    patient_id: patientId,
    accessed_by: user.id,
    reason,
  });
}
