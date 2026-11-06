import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Regra do dono: uma guia pertence a um paciente. Devolve os OUTROS pacientes
 * que já têm o mesmo número de guia no mesmo convênio (vazio = sem conflito).
 * Só avisa: quem chama decide se deixa gravar com confirmação.
 */
export async function findGuideSharedWith(
  supabase: SupabaseClient<Database>,
  params: { insurerId: string; guideNumber: string; patientId: string },
): Promise<{ patientId: string; patientName: string }[]> {
  const guideNumber = params.guideNumber.trim();
  if (!guideNumber) return [];

  const { data } = await supabase
    .from("authorizations")
    .select("patient_insurance!inner(patient_id, insurer_id, patients(full_name))")
    .eq("guide_number", guideNumber)
    .eq("patient_insurance.insurer_id", params.insurerId)
    .neq("patient_insurance.patient_id", params.patientId);

  const seen = new Map<string, string>();
  for (const row of (data ?? []) as any[]) {
    const pi = Array.isArray(row.patient_insurance) ? row.patient_insurance[0] : row.patient_insurance;
    if (!pi?.patient_id) continue;
    const pt = Array.isArray(pi.patients) ? pi.patients[0] : pi.patients;
    seen.set(pi.patient_id, pt?.full_name ?? "outro paciente");
  }
  return [...seen].map(([patientId, patientName]) => ({ patientId, patientName }));
}
