"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getPtsTemplates, type PtsTemplate } from "@/lib/pts-templates";

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string };

/**
 * Busca templates de PTS disponíveis para a clínica do usuário logado
 */
export async function fetchPtsTemplatesAction(discipline?: string): Promise<PtsTemplate[]> {
  const supabase = await createClient();
  return getPtsTemplates(supabase, { discipline, activeOnly: true });
}

/**
 * Salva uma meta formulada no PTS como um novo Template no banco da clínica
 */
export async function saveGoalAsTemplateAction(goalData: {
  discipline: string;
  domain: string;
  description: string;
  baseline?: string;
  strategy?: string;
  criterion?: string;
  horizon?: string;
  methodology?: string;
  programs?: any[];
}): Promise<ActionResult> {
  if (!goalData.discipline || !goalData.domain.trim() || !goalData.description.trim()) {
    return { success: false, error: "Preencha Disciplina, Domínio e Descrição para salvar o template." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Sessão expirada. Faça login novamente." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { success: false, error: "Clínica não identificada para este usuário." };
  }

  // Gera um título derivado da descrição (primeiros 60 chars)
  const title =
    goalData.description.length > 60
      ? goalData.description.substring(0, 57).trim() + "…"
      : goalData.description.trim();

  const programs_default = (goalData.programs ?? []).map((p) => ({
    name: p.name || "",
    targetType: p.targetType || "tentativa",
    masteryCriterion: p.masteryCriterion || "",
  }));

  const { error } = await (supabase as any).from("pts_templates").insert({
    clinic_id: profile.clinic_id,
    discipline: goalData.discipline,
    domain: goalData.domain.trim(),
    title,
    description: goalData.description.trim(),
    baseline: goalData.baseline?.trim() || null,
    strategy: goalData.strategy?.trim() || null,
    criterion: goalData.criterion?.trim() || null,
    horizon: goalData.horizon || null,
    methodology: goalData.methodology || null,
    programs_default,
    active: true,
  });

  if (error) {
    console.error("Erro ao salvar template do PTS:", error);
    return { success: false, error: `Falha ao salvar template: ${error.message}` };
  }

  revalidatePath("/supervisao/planos/novo");
  revalidatePath("/gestor/cadastros/pts-templates");
  return { success: true };
}

/**
 * Cria ou atualiza um template de PTS (para o módulo do gestor/supervisor)
 */
export async function upsertPtsTemplateAction(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "").trim();
  const discipline = String(formData.get("discipline") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const baseline = String(formData.get("baseline") ?? "").trim() || null;
  const strategy = String(formData.get("strategy") ?? "").trim() || null;
  const criterion = String(formData.get("criterion") ?? "").trim() || null;
  const horizon = String(formData.get("horizon") ?? "").trim() || null;
  const methodology = String(formData.get("methodology") ?? "").trim() || null;
  const active = formData.get("active") !== "false";

  if (!discipline || !domain || !title || !description) {
    return { success: false, error: "Disciplina, Domínio, Título e Descrição são obrigatórios." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Sessão expirada." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { success: false, error: "Clínica não encontrada." };

  const payload = {
    clinic_id: profile.clinic_id,
    discipline,
    domain,
    title,
    description,
    baseline,
    strategy,
    criterion,
    horizon,
    methodology,
    active,
    updated_at: new Date().toISOString(),
  };

  let resError = null;

  if (id) {
    const { error } = await (supabase as any)
      .from("pts_templates")
      .update(payload)
      .eq("id", id)
      .eq("clinic_id", profile.clinic_id);
    resError = error;
  } else {
    const { error } = await (supabase as any).from("pts_templates").insert(payload);
    resError = error;
  }

  if (resError) {
    return { success: false, error: resError.message };
  }

  revalidatePath("/gestor/cadastros/pts-templates");
  revalidatePath("/supervisao/planos/novo");
  return { success: true };
}

/**
 * Ativa ou desativa um template
 */
export async function togglePtsTemplateActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("pts_templates")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/gestor/cadastros/pts-templates");
  revalidatePath("/supervisao/planos/novo");
  return { success: true };
}
