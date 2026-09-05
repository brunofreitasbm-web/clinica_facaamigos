"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
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

  const supabase = await createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      full_name: childName,
      birth_date: birthDate,
      status: "lead",
      entry_source: entrySource || null,
      complaint: complaint || null,
      // first_contact_at NÃO é gravado aqui de propósito: §10.1 mede
      // first_response_min = primeiro retorno humano − criação do lead. Se
      // gravássemos no cadastro, a métrica seria sempre ~0 e o alerta "lead
      // sem retorno > 15 min" (§9.1) nunca dispararia. Fica null até alguém
      // de fato retornar o contato via registerFirstContact().
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

/**
 * Registra o primeiro retorno humano ao lead (§9.1/§10.1 first_response_min).
 * Idempotente: só grava na primeira chamada (coalesce), pra não sobrescrever
 * o timestamp real caso alguém clique de novo.
 */
export async function registerFirstContact(
  patientId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: patient, error: fetchError } = await supabase
    .from("patients")
    .select("first_contact_at")
    .eq("id", patientId)
    .maybeSingle();

  if (fetchError || !patient) {
    return { success: false, error: "Paciente não encontrado." };
  }
  if (patient.first_contact_at) {
    return { success: true };
  }

  const { data: updated, error } = await supabase
    .from("patients")
    .update({ first_contact_at: new Date().toISOString() })
    .eq("id", patientId)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { success: false, error: "Não foi possível registrar o retorno. Tente de novo." };
  }

  revalidatePath("/recepcao");
  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}
