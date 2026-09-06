import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Busca a autorização de convênio ativa (status='ativa') do paciente, se
 * houver. Usada tanto na primeira sessão da grade (`activatePatient`) quanto
 * em qualquer sessão criada depois pela agenda (`createAppointment`) — a
 * FK ambígua obriga a sintaxe `patient_insurance!inner(patient_id)`.
 *
 * `procedureCode` (opcional) restringe a busca à guia daquele procedimento/
 * disciplina — um paciente em fono e em TO precisa de uma guia por
 * disciplina, e sessão de uma não pode consumir o saldo da outra. Quando
 * informado, tenta achar uma autorização com `procedure_code` igual; se não
 * achar nenhuma (paciente ainda de disciplina única, ou guia cadastrada com
 * outro código), cai de volta pra "qualquer uma ativa" — mantém o
 * comportamento anterior pra não quebrar paciente já cadastrado.
 */
export async function getActiveAuthorizationId(
  admin: SupabaseClient<Database>,
  patientId: string,
  procedureCode?: string | null,
): Promise<string | null> {
  if (procedureCode) {
    const { data: matched } = await admin
      .from("authorizations")
      .select("id, patient_insurance!inner(patient_id)")
      .eq("patient_insurance.patient_id", patientId)
      .eq("status", "ativa")
      .eq("procedure_code", procedureCode)
      .limit(1)
      .maybeSingle();

    if (matched?.id) return matched.id;
  }

  const { data: authorization } = await admin
    .from("authorizations")
    .select("id, patient_insurance!inner(patient_id)")
    .eq("patient_insurance.patient_id", patientId)
    .eq("status", "ativa")
    .limit(1)
    .maybeSingle();

  return authorization?.id ?? null;
}
