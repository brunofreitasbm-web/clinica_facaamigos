"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

function revalidatePatient(patientId: string) {
  revalidatePath(`/gestor/pacientes/${patientId}`);
  // A ficha de recepção (app/recepcao/pacientes/[id]) mostra os mesmos dados
  // básicos do paciente (nome/nascimento/telefone) via EditBasicsForm — as
  // duas telas precisam ficar em sincronia depois de qualquer escrita aqui.
  revalidatePath(`/recepcao/pacientes/${patientId}`);
}

export async function addPatientTag(patientId: string, formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { success: false, error: "Digite um nome para a tag." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("patient_tags")
    .insert({ patient_id: patientId, label, created_by: user?.id ?? null });

  if (error) return { success: false, error: "Não foi possível adicionar a tag." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function removePatientTag(patientId: string, tagId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("patient_tags").delete().eq("id", tagId);
  if (error) return { success: false, error: "Não foi possível remover a tag." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function addPatientInsurance(patientId: string, formData: FormData): Promise<ActionResult> {
  const insurerId = String(formData.get("insurer_id") ?? "");
  const planName = String(formData.get("plan_name") ?? "").trim();
  const cardNumber = String(formData.get("card_number") ?? "").trim();

  if (!insurerId) return { success: false, error: "Selecione um convênio." };

  const supabase = await createClient();
  const { error } = await supabase.from("patient_insurance").insert({
    patient_id: patientId,
    insurer_id: insurerId,
    plan_name: planName || null,
    card_number: cardNumber || null,
    is_private: false,
  });

  if (error) return { success: false, error: "Não foi possível adicionar o convênio." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function updatePatientInsurance(patientId: string, patientInsuranceId: string, formData: FormData): Promise<ActionResult> {
  const insurerId = String(formData.get("insurer_id") ?? "");
  const planName = String(formData.get("plan_name") ?? "").trim();
  const cardNumber = String(formData.get("card_number") ?? "").trim();

  if (!insurerId) return { success: false, error: "Selecione um convênio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_insurance")
    .update({ insurer_id: insurerId, plan_name: planName || null, card_number: cardNumber || null })
    .eq("id", patientInsuranceId);

  if (error) return { success: false, error: "Não foi possível atualizar o convênio." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function deletePatientInsurance(patientId: string, patientInsuranceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("patient_insurance").delete().eq("id", patientInsuranceId);

  if (error) {
    return {
      success: false,
      error: "Não foi possível remover o convênio (pode haver autorizações vinculadas a ele).",
    };
  }

  revalidatePatient(patientId);
  return { success: true };
}

export async function addPatientCharge(patientId: string, formData: FormData): Promise<ActionResult> {
  const description = String(formData.get("description") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".");
  const amount = Number(amountRaw);
  const dueDate = String(formData.get("due_date") ?? "");

  if (!description || !amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Preencha a descrição e um valor válido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("patient_charges").insert({
    patient_id: patientId,
    description,
    amount,
    due_date: dueDate || null,
    created_by: user?.id ?? null,
  });

  if (error) return { success: false, error: "Não foi possível registrar a cobrança." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function markChargePaid(patientId: string, chargeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_charges")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", chargeId);

  if (error) return { success: false, error: "Não foi possível marcar a cobrança como paga." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function cancelCharge(patientId: string, chargeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("patient_charges").update({ status: "cancelado" }).eq("id", chargeId);

  if (error) return { success: false, error: "Não foi possível cancelar a cobrança." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function updatePatientBasics(patientId: string, formData: FormData): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const guardianId = String(formData.get("guardian_id") ?? "");

  if (!fullName || !birthDate) {
    return { success: false, error: "Preencha nome e data de nascimento." };
  }

  const supabase = await createClient();

  const { error: patientError } = await supabase
    .from("patients")
    .update({ full_name: fullName, birth_date: birthDate })
    .eq("id", patientId);

  if (patientError) return { success: false, error: "Não foi possível atualizar os dados do paciente." };

  if (phone && guardianId) {
    const { error: guardianError } = await supabase.from("guardians").update({ phone }).eq("id", guardianId);
    if (guardianError) return { success: false, error: "Paciente salvo, mas houve erro ao atualizar o telefone." };
  }

  revalidatePatient(patientId);
  return { success: true };
}

export async function setPatientArchived(patientId: string, archived: boolean): Promise<ActionResult> {
  const supabase = await createClient();

  if (archived) {
    const { error } = await supabase.from("patients").update({ status: "arquivado" }).eq("id", patientId);
    if (error) return { success: false, error: "Não foi possível arquivar o paciente." };
  } else {
    const { error } = await supabase.from("patients").update({ status: "ativo" }).eq("id", patientId);
    if (error) return { success: false, error: "Não foi possível reativar o paciente." };
  }

  revalidatePatient(patientId);
  revalidatePath("/gestor/cadastros");
  return { success: true };
}
