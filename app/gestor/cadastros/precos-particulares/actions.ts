"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { invalidateKnowledgeCache } from "@/lib/twilio-faq-bot";

type ActionResult = { success: true } | { success: false; error: string };

const PATH = "/gestor/cadastros/precos-particulares";

/**
 * Preços particulares por especialidade (specialty_prices) — RLS restrita a
 * gestor (leitura é liberada pra clínica inteira, escrita não). Aqui a gente
 * simplesmente tenta o upsert e traduz o erro de RLS numa mensagem amigável
 * em vez de checar o papel do usuário no client, seguindo o mesmo padrão de
 * app/gestor/contratos/actions.ts.
 */
export async function upsertSpecialtyPrice(formData: FormData): Promise<ActionResult> {
  const specialtyValue = String(formData.get("specialty_value") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const durationRaw = String(formData.get("duration_minutes") ?? "").trim();

  if (!specialtyValue) {
    return { success: false, error: "Especialidade inválida." };
  }

  const price = Number(priceRaw.replace(",", "."));
  if (!priceRaw || !Number.isFinite(price) || price <= 0) {
    return { success: false, error: "Preço é obrigatório e deve ser maior que zero." };
  }

  const duration = durationRaw ? Number(durationRaw) : 50;
  if (!Number.isFinite(duration) || duration <= 0) {
    return { success: false, error: "Duração deve ser maior que zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("specialty_prices")
    .upsert(
      {
        clinic_id: DEV_CLINIC_ID,
        specialty_value: specialtyValue,
        price,
        duration_minutes: duration,
      },
      { onConflict: "clinic_id,specialty_value" },
    );

  if (error) {
    return {
      success: false,
      error: `Não foi possível salvar o preço — verifique se você tem permissão de gestor. (${error.message})`,
    };
  }

  revalidatePath(PATH);
  invalidateKnowledgeCache(DEV_CLINIC_ID);
  return { success: true };
}

export async function toggleSpecialtyPrice(id: string, active: boolean): Promise<ActionResult> {
  if (!id) return { success: false, error: "Preço inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("specialty_prices").update({ active }).eq("id", id);

  if (error) {
    return {
      success: false,
      error: `Não foi possível atualizar este preço — verifique se você tem permissão de gestor. (${error.message})`,
    };
  }

  revalidatePath(PATH);
  invalidateKnowledgeCache(DEV_CLINIC_ID);
  return { success: true };
}

export async function updateDefaultSessionsPerMonth(formData: FormData): Promise<ActionResult> {
  const raw = String(formData.get("default_sessions_per_month") ?? "").trim();
  const sessions = Number(raw);

  if (!raw || !Number.isInteger(sessions) || sessions <= 0) {
    return { success: false, error: "Número de sessões deve ser um inteiro maior que zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({ default_sessions_per_month: sessions })
    .eq("id", DEV_CLINIC_ID);

  if (error) {
    return {
      success: false,
      error: `Não foi possível atualizar o nº de sessões do pacote mensal — verifique se você tem permissão de gestor. (${error.message})`,
    };
  }

  revalidatePath(PATH);
  invalidateKnowledgeCache(DEV_CLINIC_ID);
  return { success: true };
}
