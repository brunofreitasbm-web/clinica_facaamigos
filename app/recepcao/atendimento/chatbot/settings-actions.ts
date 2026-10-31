"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { invalidateKnowledgeCache } from "@/lib/twilio-faq-bot";
import { getTwilioClient } from "@/lib/twilio";
import { WELCOME_CONTENTS, contentCreatePayload, type WelcomeContentColumn } from "@/lib/welcome-menu-contents-pure";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Configurações globais do bot (`chatbot_settings`, uma linha por clínica).
 * Lidas com cache em lib/twilio-faq-bot.ts (teto diário) e lib/twilio.ts
 * (chave-geral e saudação de fallback) — ver comentários nesses arquivos.
 */
export async function updateChatbotSettings(formData: FormData): Promise<ActionResult> {
  const botEnabled = formData.get("botEnabled") === "on";
  const dailyReplyLimitRaw = String(formData.get("dailyReplyLimit") ?? "").trim();
  const greetingFallback = String(formData.get("greetingFallback") ?? "").trim();
  const botAutoResumeHoursRaw = String(formData.get("botAutoResumeHours") ?? "0").trim();
  const agendaStatusNote = String(formData.get("agendaStatusNote") ?? "").trim();
  const particularPricesImageUrl = String(formData.get("particularPricesImageUrl") ?? "").trim();

  const dailyReplyLimit = Number(dailyReplyLimitRaw);
  if (!Number.isInteger(dailyReplyLimit) || dailyReplyLimit < 1) {
    return { success: false, error: "O teto diário de respostas deve ser um número inteiro maior que zero." };
  }

  const botAutoResumeHours = Number(botAutoResumeHoursRaw);
  if (!Number.isInteger(botAutoResumeHours) || botAutoResumeHours < 0) {
    return { success: false, error: "A retomada automática deve ser um número inteiro de horas (0 = desligado)." };
  }

  if (agendaStatusNote.length > 600) {
    return { success: false, error: "A situação da agenda deve ter até 600 caracteres (1 a 3 frases curtas)." };
  }

  // O Twilio busca a imagem pela URL: só https, com cara de imagem.
  if (particularPricesImageUrl && !/^https:\/\/\S+\.(jpe?g|png)(\?\S*)?$/i.test(particularPricesImageUrl)) {
    return { success: false, error: "A imagem de valores deve ser uma URL https de um arquivo JPEG ou PNG." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("chatbot_settings").upsert(
    {
      clinic_id: DEV_CLINIC_ID,
      bot_enabled: botEnabled,
      daily_reply_limit: dailyReplyLimit,
      greeting_fallback: greetingFallback || null,
      bot_auto_resume_hours: botAutoResumeHours || null,
      agenda_status_note: agendaStatusNote || null,
      particular_prices_image_url: particularPricesImageUrl || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "clinic_id" },
  );

  if (error) {
    return { success: false, error: "Não foi possível salvar — verifique se você tem permissão de supervisão/gestão." };
  }

  // `revalidatePath` só invalida o cache do Next nesta instância; o gate
  // humano/chave-geral do bot (lib/twilio.ts) e o teto diário/saudação
  // (lib/twilio-faq-bot.ts) leem de um cache em memória do módulo com TTL
  // próprio, então sem isto o toggle "desligar bot" demorava até o cache
  // vencer (minutos) para valer.
  invalidateKnowledgeCache(DEV_CLINIC_ID);

  revalidatePath("/recepcao/atendimento");
  return { success: true };
}

export type CreateMenuContentsResult =
  | { success: true; created: string[]; skipped: string[]; failed: { label: string; error: string }[] }
  | { success: false; error: string };

/**
 * Cria na Twilio (Content API) os 4 conteúdos do menu interativo do WhatsApp e grava os
 * identificadores (HX...) em `chatbot_settings`, de onde o bot os lê (lib/welcome-menu.ts).
 * É o equivalente ao script scripts/create-welcome-menu-template.ts, mas roda no servidor, onde
 * as credenciais da Twilio já existem. São mensagens de sessão: sem aprovação da Meta.
 *
 * Idempotente: conteúdo já criado não é recriado, a menos que `replace` seja true (aí os
 * antigos ficam na Twilio, sem uso, e o bot passa a usar os novos). Só supervisão/gestão.
 */
export async function createWelcomeMenuContents(replace = false): Promise<CreateMenuContentsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Não autorizado." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "supervisor" && profile?.role !== "gestor") {
    return { success: false, error: "Só supervisão ou gestão pode criar o menu interativo." };
  }

  const client = getTwilioClient();
  if (!client) return { success: false, error: "As credenciais da Twilio não estão configuradas neste ambiente." };

  const { data: current } = await supabase
    .from("chatbot_settings")
    .select("welcome_menu_content_sid, particular_menu_content_sid, nav_back_content_sid, particular_actions_content_sid")
    .eq("clinic_id", DEV_CLINIC_ID)
    .maybeSingle();

  const saved: Partial<Record<WelcomeContentColumn, string>> = {};
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: { label: string; error: string }[] = [];

  for (const def of WELCOME_CONTENTS) {
    if (current?.[def.column] && !replace) {
      skipped.push(def.label);
      continue;
    }
    try {
      // O SDK posta o corpo cru (snake_case); os tipos dele são camelCase, daí o cast.
      const content = await client.content.v1.contents.create(contentCreatePayload(def) as never);
      saved[def.column] = content.sid;
      created.push(def.label);
    } catch (err) {
      const e = err as { message?: string; code?: number };
      failed.push({ label: def.label, error: `${e.message ?? "erro desconhecido"}${e.code ? ` (código ${e.code})` : ""}` });
    }
  }

  // Grava o que deu certo, mesmo que outro conteúdo tenha falhado (rodar de novo só cria o que falta).
  if (Object.keys(saved).length > 0) {
    const { error } = await supabase
      .from("chatbot_settings")
      .upsert({ clinic_id: DEV_CLINIC_ID, ...saved, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "clinic_id" });
    if (error) {
      return {
        success: false,
        error: `Os conteúdos foram criados na Twilio (${Object.values(saved).join(", ")}), mas não foi possível gravar os identificadores: cadastre-os na Vercel como variáveis de ambiente.`,
      };
    }
  }

  invalidateKnowledgeCache(DEV_CLINIC_ID);
  revalidatePath("/recepcao/atendimento");
  return { success: true, created, skipped, failed };
}
