"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

export async function saveAnamnese(patientId: string, formData: FormData): Promise<ActionResult> {
  // Seção: Queixa e História Atual
  const chiefComplaint = String(formData.get("chief_complaint") ?? "").trim();
  const complaintHistory = String(formData.get("complaint_history") ?? "").trim();

  // Seção: Histórico do Desenvolvimento
  const gestationalHistory = String(formData.get("gestational_history") ?? "").trim();
  const motorDevelopment = String(formData.get("motor_development") ?? "").trim();
  const languageDevelopment = String(formData.get("language_development") ?? "").trim();
  const cognitiveDevelopment = String(formData.get("cognitive_development") ?? "").trim();

  // Seção: Histórico Médico e Saúde
  const allergies = String(formData.get("allergies") ?? "").trim();
  const medications = String(formData.get("medications") ?? "").trim();
  const medicalHistory = String(formData.get("medical_history") ?? "").trim();

  // Seção: Histórico de Tratamentos Anteriores
  const previousTreatments = String(formData.get("previous_treatments") ?? "").trim();
  const treatmentOutcomes = String(formData.get("treatment_outcomes") ?? "").trim();

  // Seção: Contexto Familiar e Escolar
  const familyComposition = String(formData.get("family_composition") ?? "").trim();
  const routine = String(formData.get("routine") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();

  // Seção: Prioridades da Família
  const familyPriorities = String(formData.get("family_priorities") ?? "").trim();

  // Checkboxes
  const presentedPillars = formData.get("presented_pillars") === "on";
  const presentedAbsencePolicy = formData.get("presented_absence_policy") === "on";
  const presentedProtocols = formData.get("presented_protocols") === "on";

  if (!chiefComplaint && !routine && !familyPriorities) {
    return { success: false, error: "Preencha ao menos a queixa principal ou as prioridades da família." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  // Uma anamnese por paciente (a mais recente é a válida) — o unique index
  // não existe no banco (permite reaplicar em reavaliações futuras), então
  // checamos aqui só pra avisar quando já existe uma e evitar duplicidade
  // acidental no cadastro inicial.
  const { count: existing } = await supabase
    .from("anamneses")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  if ((existing ?? 0) > 0) {
    return { success: false, error: "Este paciente já tem uma anamnese registrada." };
  }

  const { error } = await supabase.from("anamneses").insert({
    patient_id: patientId,
    conducted_by: user.id,
    structured: {
      // Queixa e História Atual
      chief_complaint: chiefComplaint || null,
      complaint_history: complaintHistory || null,
      // Histórico do Desenvolvimento
      gestational_history: gestationalHistory || null,
      motor_development: motorDevelopment || null,
      language_development: languageDevelopment || null,
      cognitive_development: cognitiveDevelopment || null,
      // Histórico Médico e Saúde
      allergies: allergies || null,
      medications: medications || null,
      medical_history: medicalHistory || null,
      // Histórico de Tratamentos Anteriores
      previous_treatments: previousTreatments || null,
      treatment_outcomes: treatmentOutcomes || null,
      // Contexto Familiar e Escolar
      family_composition: familyComposition || null,
      routine: routine || null,
      school: school || null,
      // Prioridades da Família
      family_priorities: familyPriorities || null,
    },
    free_text: null,
    presented_pillars: presentedPillars,
    presented_absence_policy: presentedAbsencePolicy,
    presented_protocols: presentedProtocols,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar a anamnese. Verifique sua permissão para este paciente." };
  }

  // Prioridades da família alimentam o PTS (slide 22 — "a família relatou
  // uma prioridade, mas ela não chegou ao PDI"): gravamos também em
  // patients-adjacent nenhuma coluna própria existe, então fica só em
  // anamneses.structured; o formulário do PTS busca de lá.

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  revalidatePath(`/supervisao/pacientes/${patientId}/anamnese`);
  revalidatePath("/supervisao");
  return { success: true };
}
