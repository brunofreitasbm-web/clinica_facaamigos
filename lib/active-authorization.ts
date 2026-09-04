import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Busca a autorização de convênio ativa (status='ativa') do paciente, se
 * houver. Usada tanto na primeira sessão da grade (`activatePatient`) quanto
 * em qualquer sessão criada depois pela agenda (`createAppointment`) — a
 * FK ambígua obriga a sintaxe `patient_insurance!inner(patient_id)`.
 */
export async function getActiveAuthorizationId(
  admin: SupabaseClient<Database>,
  patientId: string,
): Promise<string | null> {
  const { data: authorization } = await admin
    .from("authorizations")
    .select("id, patient_insurance!inner(patient_id)")
    .eq("patient_insurance.patient_id", patientId)
    .eq("status", "ativa")
    .limit(1)
    .maybeSingle();

  return authorization?.id ?? null;
}
