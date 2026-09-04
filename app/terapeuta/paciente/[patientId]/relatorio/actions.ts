"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, DEVOLUTION_REPORT_MODEL } from "@/lib/anthropic";

type ActionResult = { success: true } | { success: false; error: string };
type GenerateResult = { success: true; reportId: string; draft: string } | { success: false; error: string };

const SYSTEM_PROMPT = `Você ajuda uma clínica de terapia infantil (TEA) a redigir um "Relatório Devolutivo Familiar" —
um resumo do período pra pais/responsáveis, a partir de anotações clínicas técnicas.

Regras estritas:
- Tom humanizado, acolhedor, direto — como se estivesse conversando com a família, não escrevendo um laudo.
- PROIBIDO jargão técnico não explicado (ex.: "esteve em latência de resposta", "mando motor", termos de protocolos
  como VB-MAPP/ABLLS/ESDM, códigos de programa). Traduza tudo pra linguagem do dia a dia.
- Foque em progresso concreto e observável, não em terminologia de avaliação.
- Nunca invente informação que não esteja nas anotações fornecidas.
- 3 a 5 parágrafos curtos. Sem saudação nem despedida (isso é adicionado pela clínica depois).`;

function buildUserPrompt(input: {
  patientName: string;
  periodStart: string;
  periodEnd: string;
  sessionNotes: string[];
  goals: { description: string; domain: string; status: string }[];
}): string {
  const notesBlock =
    input.sessionNotes.length > 0
      ? input.sessionNotes.map((n, i) => `Nota ${i + 1}: ${n}`).join("\n\n")
      : "(nenhuma anotação de sessão registrada neste período)";

  const goalsBlock =
    input.goals.length > 0
      ? input.goals.map((g) => `- [${g.status}] ${g.domain}: ${g.description}`).join("\n")
      : "(nenhuma meta cadastrada no plano terapêutico)";

  return `Criança: ${input.patientName}
Período: ${input.periodStart} a ${input.periodEnd}

Anotações de sessão do período:
${notesBlock}

Metas do plano terapêutico:
${goalsBlock}

Escreva o Relatório Devolutivo Familiar para este período.`;
}

/**
 * Agrega session_notes.free_text + plan_goals do período (RLS já garante
 * que só terapeuta vinculado/supervisor/gestor chega aqui) e chama a API
 * Anthropic pra gerar o rascunho — PRD §9. Aprovação manual é obrigatória
 * (approveDevolutionReport); esta função só grava o rascunho, nunca envia
 * nada à família.
 */
export async function generateDevolutionDraft(
  patientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<GenerateResult> {
  if (!periodStart || !periodEnd || periodEnd < periodStart) {
    return { success: false, error: "Selecione um período válido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: patient } = await supabase
    .from("patients")
    .select("full_name")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) return { success: false, error: "Paciente não encontrado." };

  const { data: notesRaw } = await supabase
    .from("session_notes")
    .select("free_text, appointments!inner(patient_id, starts_at)")
    .eq("appointments.patient_id", patientId)
    .gte("appointments.starts_at", `${periodStart}T00:00:00`)
    .lte("appointments.starts_at", `${periodEnd}T23:59:59`)
    .not("free_text", "is", null);

  const { data: treatmentPlan } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .eq("status", "aprovado")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: goalsRaw } = treatmentPlan
    ? await supabase
        .from("plan_goals")
        .select("description, domain, status")
        .eq("treatment_plan_id", treatmentPlan.id)
    : { data: [] as { description: string; domain: string; status: string }[] };

  const sessionNotes = (notesRaw ?? []).map((n) => n.free_text).filter((t): t is string => !!t);

  let anthropic;
  try {
    anthropic = createAnthropicClient();
  } catch {
    return { success: false, error: "Servidor sem ANTHROPIC_API_KEY configurada — avise o time técnico." };
  }

  let draftText: string;
  try {
    const response = await anthropic.messages.create({
      model: DEVOLUTION_REPORT_MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            patientName: patient.full_name,
            periodStart,
            periodEnd,
            sessionNotes,
            goals: goalsRaw ?? [],
          }),
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    draftText = textBlock && "text" in textBlock ? textBlock.text : "";
    if (!draftText) throw new Error("resposta vazia");
  } catch {
    return { success: false, error: "Não foi possível gerar o rascunho agora. Tente de novo." };
  }

  const { data: report, error: insertError } = await supabase
    .from("draft_reports")
    .insert({
      patient_id: patientId,
      period_start: periodStart,
      period_end: periodEnd,
      generated_by: user.id,
      ai_draft: draftText,
      final_text: draftText,
    })
    .select("id")
    .single();

  if (insertError || !report) {
    return { success: false, error: "Rascunho gerado, mas não foi possível salvá-lo. Tente de novo." };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/relatorio`);
  return { success: true, reportId: report.id, draft: draftText };
}

export async function saveDraftText(patientId: string, reportId: string, finalText: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("draft_reports")
    .update({ final_text: finalText, status: "em_revisao" })
    .eq("id", reportId)
    .in("status", ["gerado", "em_revisao"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "Não foi possível salvar a edição." };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/relatorio`);
  return { success: true };
}

/**
 * Aprovação manual obrigatória (PRD §9) — nenhum relatório sai daqui direto
 * pro ai_draft; o terapeuta precisa revisar e confirmar o texto final.
 */
export async function approveDevolutionReport(
  patientId: string,
  reportId: string,
  finalText: string,
): Promise<ActionResult> {
  if (!finalText.trim()) {
    return { success: false, error: "O texto final não pode ficar vazio." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data, error } = await supabase
    .from("draft_reports")
    .update({
      final_text: finalText,
      status: "aprovado",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .in("status", ["gerado", "em_revisao"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "Não foi possível aprovar — verifique se o relatório já não foi aprovado." };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/relatorio`);
  return { success: true };
}

/**
 * Envio final — vira post no mural da família (item 4, feed_posts), único
 * canal família-facing definido no PRD "11 incrementos" até agora. Só
 * relatórios já 'aprovado' podem ser enviados.
 */
export async function sendDevolutionReport(patientId: string, reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: report } = await supabase
    .from("draft_reports")
    .select("id, patient_id, final_text, status")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { success: false, error: "Relatório não encontrado." };
  if (report.status !== "aprovado") {
    return { success: false, error: "Só é possível enviar um relatório já aprovado." };
  }
  if (!report.final_text) {
    return { success: false, error: "Relatório sem texto final." };
  }

  const { error: postError } = await supabase.from("feed_posts").insert({
    patient_id: report.patient_id,
    author_id: user.id,
    body: report.final_text,
  });

  if (postError) {
    return { success: false, error: "Não foi possível publicar no mural da família." };
  }

  const { error: updateError } = await supabase
    .from("draft_reports")
    .update({ status: "enviado" })
    .eq("id", reportId);

  if (updateError) {
    return { success: false, error: "Publicado no mural, mas houve erro ao atualizar o status do relatório." };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/relatorio`);
  return { success: true };
}
