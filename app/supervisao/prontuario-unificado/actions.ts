"use server";

import { createClient } from "@/lib/supabase/server";

/** Registra no LGPD access log (record_access_log) que este prontuário unificado foi aberto para o paciente — mesma trilha que alimenta /gestor/auditoria. */
export async function logProntuarioAccess(patientId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("log_patient_access", { p_patient_id: patientId, p_reason: "prontuario" });
}
