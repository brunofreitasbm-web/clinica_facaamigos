import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, DEV_RECEPTION_PROFILE_ID } from "@/lib/constants";
import { DocumentosManager, type PatientOption } from "./documentos-manager";

export const dynamic = "force-dynamic";

export default async function DocumentosRecepcaoPage() {
  const supabase = await createClient();

  // Fetch patients list
  const { data: rawPatients } = await supabase
    .from("patients")
    .select("id, full_name, birth_date, status")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name");

  const patientIds = (rawPatients ?? []).map((p) => p.id);

  // Fetch guardians list to map guardian info to patients
  const { data: rawGuardians } = patientIds.length
    ? await supabase
        .from("guardians")
        .select("patient_id, full_name, phone, is_financial, is_emergency_contact")
        .in("patient_id", patientIds)
    : { data: [] as { patient_id: string; full_name: string; phone: string; is_financial: boolean; is_emergency_contact: boolean }[] };

  // Map primary guardian per patient
  const guardianByPatient = new Map<
    string,
    { fullName: string; phone: string }
  >();
  for (const g of rawGuardians ?? []) {
    if (!guardianByPatient.has(g.patient_id) || g.is_financial || g.is_emergency_contact) {
      guardianByPatient.set(g.patient_id, {
        fullName: g.full_name,
        phone: g.phone,
      });
    }
  }

  // Fetch current reception profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", DEV_RECEPTION_PROFILE_ID)
    .maybeSingle();

  const patients: PatientOption[] = (rawPatients ?? []).map((p) => {
    const guardian = guardianByPatient.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      birthDate: p.birth_date,
      status: p.status,
      guardianName: guardian?.fullName || null,
      guardianPhone: guardian?.phone || null,
    };
  });

  return (
    <DocumentosManager
      patients={patients}
      currentProfile={
        profile
          ? {
              id: profile.id,
              fullName: profile.full_name,
              role: profile.role,
            }
          : null
      }
    />
  );
}
