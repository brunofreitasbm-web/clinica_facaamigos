"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const CATEGORIES = ["convenios", "valores", "local", "terapias", "horarios", "regras", "outro"] as const;
export type FaqCategory = (typeof CATEGORIES)[number];

/** "unimed, plano, carteirinha" -> ['unimed','plano','carteirinha'] */
function parseKeywords(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function readForm(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const rawCategory = String(formData.get("category") ?? "").trim();
  const category = (CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : "outro";
  const keywords = parseKeywords(String(formData.get("keywords") ?? ""));
  return { question, answer, category, keywords };
}

/**
 * Base de conhecimento do agente de WhatsApp (`clinic_faq`). RLS deixa só
 * gestor e supervisor escreverem; a recepção lê para usar como resposta rápida
 * na Central de Atendimento. O bot é instruído a ESCALAR quando não encontra a
 * informação aqui, então uma resposta ausente vira atendimento humano — nunca
 * uma invenção sobre preço ou cobertura (ver lib/twilio-faq-bot.ts).
 */
export async function createFaq(formData: FormData): Promise<ActionResult> {
  const { question, answer, category, keywords } = readForm(formData);

  if (!question) return { success: false, error: "Escreva a pergunta." };
  if (!answer) return { success: false, error: "Escreva a resposta que o bot deve enviar." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("clinic_faq")
    .select("sort_order")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("sort_order", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("clinic_faq").insert({
    clinic_id: DEV_CLINIC_ID,
    question,
    answer,
    category,
    keywords,
    sort_order: (last?.[0]?.sort_order ?? 0) + 10,
  });

  if (error) {
    return { success: false, error: "Você não tem permissão para cadastrar perguntas." };
  }

  revalidatePath("/gestor/cadastros/faq");
  return { success: true };
}

export async function updateFaq(faqId: string, formData: FormData): Promise<ActionResult> {
  const { question, answer, category, keywords } = readForm(formData);

  if (!question) return { success: false, error: "Escreva a pergunta." };
  if (!answer) return { success: false, error: "Escreva a resposta que o bot deve enviar." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_faq")
    .update({ question, answer, category, keywords, updated_at: new Date().toISOString() })
    .eq("id", faqId);

  if (error) {
    return { success: false, error: "Não foi possível salvar esta pergunta." };
  }

  revalidatePath("/gestor/cadastros/faq");
  return { success: true };
}

export async function toggleFaqActive(faqId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_faq")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", faqId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar esta pergunta." };
  }

  revalidatePath("/gestor/cadastros/faq");
  return { success: true };
}

export async function deleteFaq(faqId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("clinic_faq").delete().eq("id", faqId);

  if (error) {
    return { success: false, error: "Não foi possível excluir esta pergunta." };
  }

  revalidatePath("/gestor/cadastros/faq");
  return { success: true };
}
