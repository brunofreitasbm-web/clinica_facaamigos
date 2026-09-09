"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const CATEGORIES = ["confirmacao_d1", "falta", "cobranca", "aniversario", "renovacao_guia", "outro"] as const;
const CHANNELS = ["whatsapp", "sms"] as const;

/** Cadastro de modelo de mensagem. RLS (message_templates_manage) restringe a gestor/supervisor. */
export async function createTemplate(formData: FormData): Promise<ActionResult> {
  const category = String(formData.get("category") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "whatsapp");
  const body = String(formData.get("body") ?? "").trim();

  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { success: false, error: "Selecione uma categoria válida." };
  }
  if (!name) return { success: false, error: "Dê um nome ao modelo." };
  if (!CHANNELS.includes(channel as (typeof CHANNELS)[number])) {
    return { success: false, error: "Selecione um canal válido." };
  }
  if (!body) return { success: false, error: "Escreva o texto do modelo." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("message_templates").insert({
    clinic_id: DEV_CLINIC_ID,
    category,
    name,
    channel,
    body,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { success: false, error: "Não foi possível cadastrar o modelo — verifique se você tem permissão de supervisão/gestão." };
  }

  revalidatePath("/recepcao/atendimento");
  return { success: true };
}

export async function toggleTemplateActive(templateId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").update({ active }).eq("id", templateId);

  if (error) return { success: false, error: "Não foi possível atualizar o modelo." };

  revalidatePath("/recepcao/atendimento");
  return { success: true };
}

export async function toggleMetaApproved(templateId: string, metaApproved: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").update({ meta_approved: metaApproved }).eq("id", templateId);

  if (error) return { success: false, error: "Não foi possível atualizar o modelo." };

  revalidatePath("/recepcao/atendimento");
  return { success: true };
}
