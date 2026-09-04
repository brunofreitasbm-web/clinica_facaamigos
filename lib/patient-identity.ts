import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type PatientIdentitySummary = {
  insurance: { insurerName: string; cardNumber: string | null } | null;
  emergencyContact: { name: string; phone: string } | null;
  activeAuthorization: {
    guideNumber: string | null;
    sessionsUsed: number;
    sessionsAuthorized: number;
    validTo: string;
  } | null;
};

/**
 * Dados do header de identificação do paciente (PRD "11 incrementos" §1):
 * convênio ativo (o vinculado à autorização "ativa"; sem uma, o primeiro
 * patient_insurance cadastrado; sem nenhum, null = "Particular") e contato
 * de emergência (guardian marcado, ou o único responsável quando só há um).
 * Compartilhado entre a ficha da recepção e a tela de evolução do terapeuta
 * pra não divergir a lógica de fallback entre as duas.
 */
export async function getPatientIdentitySummary(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<PatientIdentitySummary> {
  const [{ data: activeAuth }, { data: patientInsurances }, { data: guardians }] = await Promise.all([
    supabase
      .from("authorizations")
      .select(
        "patient_insurance_id, guide_number, sessions_used, sessions_authorized, valid_to, patient_insurance!inner(patient_id)",
      )
      .eq("patient_insurance.patient_id", patientId)
      .eq("status", "ativa")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("patient_insurance")
      .select("id, card_number, insurers(name)")
      .eq("patient_id", patientId),
    supabase
      .from("guardians")
      .select("full_name, phone, is_emergency_contact")
      .eq("patient_id", patientId),
  ]);

  const activeInsuranceRow =
    (patientInsurances ?? []).find((pi) => pi.id === activeAuth?.patient_insurance_id) ??
    (patientInsurances ?? [])[0] ??
    null;

  // `insurers` vem embutido via FK — o supabase-js tipa como objeto ou
  // array dependendo da relação; mesma normalização defensiva usada em
  // getPendingPatients (lib/patient-stage.ts) para patient_insurance.
  const insurance = activeInsuranceRow
    ? {
        insurerName:
          (Array.isArray(activeInsuranceRow.insurers)
            ? activeInsuranceRow.insurers[0]?.name
            : activeInsuranceRow.insurers?.name) ?? "Convênio sem nome",
        cardNumber: activeInsuranceRow.card_number,
      }
    : null;

  const emergencyGuardian =
    (guardians ?? []).find((g) => g.is_emergency_contact) ??
    ((guardians ?? []).length === 1 ? guardians![0] : null);

  return {
    insurance,
    emergencyContact: emergencyGuardian
      ? { name: emergencyGuardian.full_name, phone: emergencyGuardian.phone }
      : null,
    activeAuthorization: activeAuth
      ? {
          guideNumber: activeAuth.guide_number,
          sessionsUsed: activeAuth.sessions_used,
          sessionsAuthorized: activeAuth.sessions_authorized,
          validTo: activeAuth.valid_to,
        }
      : null,
  };
}
