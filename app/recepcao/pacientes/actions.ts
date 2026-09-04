"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";

export async function createLead(
  formData: FormData,
): Promise<{ success: true; patientId: string } | { success: false; error: string }> {
  const childName = String(formData.get("child_name") ?? "").trim();
  const guardianName = String(formData.get("guardian_name") ?? "").trim();
  const guardianPhone = String(formData.get("guardian_phone") ?? "").trim();
  const entrySource = String(formData.get("entry_source") ?? "").trim();
  const complaint = String(formData.get("complaint") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "");

  if (!childName || !guardianName || !guardianPhone || !birthDate) {
    return { success: false, error: "Nome da criança, responsável, telefone e data de nascimento são obrigatórios." };
  }

  const supabase = createAdminClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      full_name: childName,
      birth_date: birthDate,
      status: "lead",
      entry_source: entrySource || null,
      complaint: complaint || null,
      first_contact_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (patientError || !patient) {
    return { success: false, error: "Não foi possível salvar o paciente. Tente de novo." };
  }

  const { error: guardianError } = await supabase.from("guardians").insert({
    patient_id: patient.id,
    full_name: guardianName,
    phone: guardianPhone,
  });

  if (guardianError) {
    return { success: false, error: "Paciente salvo, mas houve erro ao salvar o responsável." };
  }

  return { success: true, patientId: patient.id };
}
