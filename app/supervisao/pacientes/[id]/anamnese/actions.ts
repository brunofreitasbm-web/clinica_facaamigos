"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

export async function saveAnamnese(patientId: string, formData: FormData): Promise<ActionResult> {
  const freeText = String(formData.get("free_text") ?? "").trim();
  const routine = String(formData.get("routine") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const medications = String(formData.get("medications") ?? "").trim();
  const familyPriorities = String(formData.get("family_priorities") ?? "").trim();
  const presentedPillars = formData.get("presented_pillars") === "on";
  const presentedAbsencePolicy = formData.get("presented_absence_policy") === "on";
  const presentedProtocols = formData.get("presented_protocols") === "on";

  if (!freeText && !routine && !familyPriorities) {
    return { success: false, error: "Preencha ao menos o histórico/queixa ou as prioridades da família." };
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
      routine: routine || null,
      school: school || null,
      medications: medications || null,
      family_priorities: familyPriorities || null,
    },
    free_text: freeText || null,
    presented_pillars: presentedPillars,
    presented_absence_policy: presentedAbsencePolicy,
    presented_protocols: presentedProtocols,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar a anamnese. Verifique sua permissão para este paciente." };
  }

  // Prioridades da família alimentam o PDI (slide 22 — "a família relatou
  // uma prioridade, mas ela não chegou ao PDI"): gravamos também em
  // patients-adjacent nenhuma coluna própria existe, então fica só em
  // anamneses.structured; o formulário do PDI busca de lá.

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  revalidatePath(`/supervisao/pacientes/${patientId}/anamnese`);
  revalidatePath("/supervisao");
  return { success: true };
}
