// lib/welcome-menu.ts
// Menu inicial do WhatsApp: envio (lista interativa da Twilio, com texto
// numerado de reserva) e as ações de cada opção. Textos, opções e leitura das
// respostas ficam em lib/welcome-menu-pure.ts.
//
// O roteador (lib/twilio.ts) chama:
//   - sendMainMenu: primeiro contato (ou mais de 6 h sem resposta da clínica);
//   - processWelcomeMenuStep: toque/número/título nas listas, VOLTAR e MENU.
//
// Respostas só-texto voltam em `replyMessage` (o webhook envia e registra). As
// que usam Content (lista, botões) ou imagem são enviadas aqui e registradas
// em `messages` com o intent — é o intent da última mensagem do bot que diz em
// qual tela a pessoa está.
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { APP_ORIGIN, CLINIC_MAPS_URL, getClinicIdentity } from "@/lib/clinic-identity";
import { formatBusinessHours } from "@/lib/business-hours-pure";
import { buildMessagePreview, formatE164Phone } from "@/lib/twilio";
import { sendWhatsApp } from "@/lib/whatsapp";
import { loadParticularPlanCatalog } from "@/lib/particular-plans";
import { loadActiveInsurers, startAnamnesisFlow } from "@/lib/twilio-anamnesis-bot";
import {
  BACK_TO_MENU_FOOTER,
  CURRICULO_REPLY,
  DUVIDAS_PROMPT,
  ESCALATION_PARTICULAR_AGENDAR,
  HUMANO_HANDOFF,
  MENU_INTENT,
  PARTICULAR_AGENDAR_COLETA,
  PARTICULAR_AGENDAR_OBRIGADO,
  PARTICULAR_COLETA_INTENT,
  PARTICULAR_COMO_FUNCIONA,
  PARTICULAR_COMO_FUNCIONA_INTENT,
  PARTICULAR_MENU_INTENT,
  PARTICULAR_MENU_TEXT,
  PARTICULAR_PLANS,
  PARTICULAR_VALORES_INTENT,
  PART_AGENDAR_ID,
  WELCOME_MENU_TEXT,
  buildConhecerMessage,
  buildParticularPricesCaption,
  buildParticularPricesText,
  buildPlanoIntro,
  buildTherapiesMessage,
  normalizeMenuText,
  parseNavReply,
  parseParticularActionReply,
  parseParticularMenuReply,
  parseWelcomeMenuReply,
  previousMenuFor,
  type ParticularPlan,
} from "@/lib/welcome-menu-pure";

export type MenuStepResult = { handled: boolean; replyMessage: string; intent: string };

const NOT_HANDLED: MenuStepResult = { handled: false, replyMessage: "", intent: "" };

/** Padrão da arte de valores: arquivo servido pelo próprio app (public/chatbot). */
export const DEFAULT_PARTICULAR_PRICES_IMAGE_PATH = "/chatbot/planos-particular.jpg";

// Content SIDs: criados pelo botão "Criar menu interativo" (Chatbot > Configurações, gravados em
// `chatbot_settings`) ou pelo script scripts/create-welcome-menu-template.ts (variável de ambiente).
// Todos opcionais: sem o SID, a tela sai como texto numerado.
async function menuSids() {
  const { getChatbotSettings } = await import("./twilio-faq-bot");
  const saved = (await getChatbotSettings(DEV_CLINIC_ID)).menuContentSids;
  return {
    mainMenu: saved.welcomeMenu ?? process.env.TWILIO_WELCOME_MENU_CONTENT_SID,
    particularMenu: saved.particularMenu ?? process.env.TWILIO_PARTICULAR_MENU_CONTENT_SID,
    navBack: saved.navBack ?? process.env.TWILIO_NAV_BACK_CONTENT_SID,
    particularActions: saved.particularActions ?? process.env.TWILIO_PARTICULAR_ACTIONS_CONTENT_SID,
  };
}

type Delivery = {
  phone: string;
  conversationId: string | null;
  text: string;
  intent: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  mediaUrl?: string;
  /** Texto enviado como reserva se o Content/imagem falhar. */
  fallbackText?: string;
};

/**
 * Texto puro: devolve ao webhook, que envia e registra. Com Content ou imagem:
 * envia aqui e registra; se o envio falhar, cai no texto de reserva.
 */
async function deliver(d: Delivery): Promise<MenuStepResult> {
  if (!d.contentSid && !d.mediaUrl) return { handled: true, replyMessage: d.text, intent: d.intent };

  const send = await sendWhatsApp({
    to: d.phone,
    message: d.text,
    ...(d.mediaUrl ? { mediaUrl: [d.mediaUrl] } : {}),
    ...(d.contentSid ? { contentSid: d.contentSid, contentVariables: d.contentVariables } : {}),
  });

  if (!send.success) {
    console.error("[Welcome Menu] Envio rico falhou, usando texto:", send.error);
    return { handled: true, replyMessage: d.fallbackText ?? d.text, intent: d.intent };
  }

  try {
    const admin = createAdminClient();
    if (d.conversationId) {
      const { data: conversation } = await admin
        .from("twilio_conversations")
        .select("patient_id, guardian_id")
        .eq("id", d.conversationId)
        .maybeSingle();
      await admin.from("messages").insert({
        patient_id: conversation?.patient_id ?? null,
        guardian_id: conversation?.guardian_id ?? null,
        conversation_id: d.conversationId,
        sender_type: "bot",
        channel: "whatsapp",
        direction: "outbound",
        body: d.text,
        media_url: d.mediaUrl ?? null,
        sent_at: new Date().toISOString(),
        twilio_sid: send.messageId ?? null,
        delivery_status: "sent",
        intent: d.intent,
      });
      await admin.from("twilio_conversations").update({ last_message_preview: buildMessagePreview(d.text) }).eq("id", d.conversationId);
    }
  } catch (err) {
    console.error("[Welcome Menu] Falha ao registrar mensagem:", err);
  }
  return { handled: true, replyMessage: "", intent: d.intent };
}

export async function sendMainMenu(params: { phone: string; conversationId: string | null }): Promise<MenuStepResult> {
  const sid = (await menuSids()).mainMenu;
  return deliver({ ...params, text: WELCOME_MENU_TEXT, intent: MENU_INTENT, contentSid: sid });
}

async function sendParticularMenu(params: { phone: string; conversationId: string | null }): Promise<MenuStepResult> {
  const sid = (await menuSids()).particularMenu;
  return deliver({ ...params, text: PARTICULAR_MENU_TEXT, intent: PARTICULAR_MENU_INTENT, contentSid: sid });
}

/** Tela de texto com botão "Voltar ao menu" (quando o quick-reply existe). */
async function screenWithNavBack(params: { phone: string; conversationId: string | null }, text: string, intent: string): Promise<MenuStepResult> {
  const sid = (await menuSids()).navBack;
  return deliver({ ...params, text, intent, ...(sid ? { contentSid: sid, contentVariables: { "1": text } } : {}) });
}

async function lastBotIntent(conversationId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("messages")
    .select("intent")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .eq("sender_type", "bot")
    .order("sent_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.intent as string | null | undefined) ?? null;
}

/** O telefone não está no meio de outro fluxo do bot (AGENDAR, oferta, faltas...). */
async function isSessionIdle(phone: string): Promise<boolean> {
  const { data } = await createAdminClient().from("chatbot_sessions").select("current_step").eq("phone_number", phone).maybeSingle();
  const step = data?.current_step ?? "";
  return !step || step === "idle" || step === "completed";
}

/** Valores vigentes do convênio "Particular" (planos mensais); reserva em código. */
export async function loadParticularPlans(): Promise<ParticularPlan[]> {
  const catalog = await loadParticularPlanCatalog(createAdminClient());
  return catalog.length > 0 ? catalog.map((p) => ({ name: p.name, sessions: p.sessions, price: p.price })) : PARTICULAR_PLANS;
}

async function handoff(conversationId: string | null, reason: "pediu_humano" | "particular" | "particular_agendar", text: string): Promise<string> {
  if (!conversationId) return text;
  const { escalateConversation, isWithinBusinessHoursNow, OUT_OF_HOURS_ESCALATION_SUFFIX } = await import("./twilio-faq-bot");
  await escalateConversation(conversationId, reason);
  return (await isWithinBusinessHoursNow(DEV_CLINIC_ID)) ? text : text + OUT_OF_HOURS_ESCALATION_SUFFIX;
}

async function sendParticularValues(ctx: { phone: string; conversationId: string | null }): Promise<MenuStepResult> {
  const plans = await loadParticularPlans();
  const { getChatbotSettings } = await import("./twilio-faq-bot");
  const settings = await getChatbotSettings(DEV_CLINIC_ID);
  const imageUrl = settings.particularPricesImageUrl || `${APP_ORIGIN}${DEFAULT_PARTICULAR_PRICES_IMAGE_PATH}`;
  const caption = buildParticularPricesCaption(plans);
  // Imagem + legenda numa mensagem só (uma tarifa). Se a imagem não carregar,
  // sai o texto completo dos planos.
  return deliver({
    ...ctx,
    text: caption,
    intent: PARTICULAR_VALORES_INTENT,
    mediaUrl: imageUrl,
    fallbackText: buildParticularPricesText(plans),
  });
}

/** Intent da arte de preços enviada a partir de pergunta livre (fora do menu). */
export const FAQ_PRICES_ART_INTENT = "faq_valores_particular";

const PRICES_ART_CAPTION =
  "Estes são os nossos pacotes mensais. 💙 A quantidade e a distribuição das terapias dependem de cada criança: " +
  "a equipe vai conversar com você para montar a melhor opção. Parcelamos em até 3x no cartão.";

/**
 * Pergunta livre de preço particular (agente de FAQ): envia a arte dos pacotes
 * e passa a conversa para a equipe humana (venda consultiva). Nenhum valor vai
 * escrito em texto: o preço mora só na arte. Sem imagem, vai só o texto.
 */
export async function sendParticularPricesArtAndHandoff(ctx: { phone: string; conversationId: string | null }): Promise<MenuStepResult> {
  const { getChatbotSettings } = await import("./twilio-faq-bot");
  const settings = await getChatbotSettings(DEV_CLINIC_ID);
  const imageUrl = settings.particularPricesImageUrl || `${APP_ORIGIN}${DEFAULT_PARTICULAR_PRICES_IMAGE_PATH}`;
  const text = await handoff(ctx.conversationId, "particular", PRICES_ART_CAPTION);
  return deliver({ ...ctx, text, intent: FAQ_PRICES_ART_INTENT, mediaUrl: imageUrl });
}

async function runChoice(id: string, ctx: { phone: string; conversationId: string | null }): Promise<MenuStepResult> {
  switch (id) {
    case "menu_particular":
      return sendParticularMenu(ctx);

    case "menu_plano": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insurers = await loadActiveInsurers(createAdminClient() as any);
      await startAnamnesisFlow(ctx.phone);
      return { handled: true, replyMessage: buildPlanoIntro(insurers.map((i) => i.name)), intent: "menu_plano" };
    }

    case "menu_terapias":
      return screenWithNavBack(ctx, buildTherapiesMessage(), "menu_terapias");

    case "menu_conhecer": {
      const admin = createAdminClient();
      const [identity, hours] = await Promise.all([
        getClinicIdentity(admin, DEV_CLINIC_ID),
        admin.from("clinic_business_hours").select("day_of_week, open_time, close_time").eq("clinic_id", DEV_CLINIC_ID).order("day_of_week"),
      ]);
      const text = buildConhecerMessage({
        address: identity.endereco,
        mapsUrl: CLINIC_MAPS_URL,
        hours: formatBusinessHours(hours.data ?? []) || null,
      });
      return screenWithNavBack(ctx, text, "menu_conhecer");
    }

    case "menu_duvidas":
      return screenWithNavBack(ctx, DUVIDAS_PROMPT, "menu_duvidas");

    case "menu_curriculo": {
      if (ctx.conversationId) {
        const { closeConversationAfterFinalReply } = await import("./twilio-faq-bot");
        await closeConversationAfterFinalReply(ctx.conversationId);
      }
      return screenWithNavBack(ctx, `${CURRICULO_REPLY}\n\n${BACK_TO_MENU_FOOTER}`, "menu_curriculo");
    }

    case "menu_outros":
      return { handled: true, replyMessage: await handoff(ctx.conversationId, "pediu_humano", HUMANO_HANDOFF), intent: "menu_outros" };

    case "part_como_funciona": {
      const sid = (await menuSids()).particularActions;
      return deliver({
        ...ctx,
        text: PARTICULAR_COMO_FUNCIONA,
        intent: PARTICULAR_COMO_FUNCIONA_INTENT,
        ...(sid ? { contentSid: sid, contentVariables: { "1": PARTICULAR_COMO_FUNCIONA } } : {}),
      });
    }

    case "part_valores":
      return sendParticularValues(ctx);

    case "part_agendar":
      return { handled: true, replyMessage: PARTICULAR_AGENDAR_COLETA, intent: PARTICULAR_COLETA_INTENT };

    case "part_humano":
      return { handled: true, replyMessage: await handoff(ctx.conversationId, "particular", HUMANO_HANDOFF), intent: "part_humano" };

    default:
      return NOT_HANDLED;
  }
}

/**
 * Trata uma mensagem como escolha de menu, VOLTAR ou MENU. Não faz nada quando
 * o telefone está no meio de outro fluxo do bot (AGENDAR, oferta, faltas...), no
 * qual VOLTAR/MENU são tratados pelo próprio fluxo.
 */
export async function processWelcomeMenuStep(params: {
  from: string;
  body: string;
  listId?: string | null;
  buttonPayload?: string | null;
  conversationId: string | null;
}): Promise<MenuStepResult> {
  const phone = formatE164Phone(params.from.replace("whatsapp:", ""));
  const ctx = { phone, conversationId: params.conversationId };
  const input = { body: params.body, listId: params.listId, buttonPayload: params.buttonPayload };

  if (!params.conversationId) return NOT_HANDLED;
  if (!(await isSessionIdle(phone))) return NOT_HANDLED;

  const last = await lastBotIntent(params.conversationId);

  // VOLTAR / MENU
  const nav = parseNavReply(input);
  if (nav === "menu") return sendMainMenu(ctx);
  if (nav === "back") return previousMenuFor(last) === "particular" ? sendParticularMenu(ctx) : sendMainMenu(ctx);

  // Toque numa lista ou botão: vale mesmo que a lista seja antiga.
  const tapped = (params.listId ?? params.buttonPayload ?? "").trim();
  if (tapped.startsWith("menu_") || tapped.startsWith("part_")) return runChoice(tapped, ctx);

  // Texto digitado (número ou título), conforme a tela anterior.
  if (last === MENU_INTENT) {
    const id = parseWelcomeMenuReply(input);
    return id ? runChoice(id, ctx) : NOT_HANDLED;
  }
  if (last === PARTICULAR_MENU_INTENT) {
    const id = parseParticularMenuReply(input);
    if (id === "nav_back") return sendMainMenu(ctx);
    return id ? runChoice(id, ctx) : NOT_HANDLED;
  }
  if (last === PARTICULAR_COMO_FUNCIONA_INTENT || last === PARTICULAR_VALORES_INTENT) {
    const id = parseParticularActionReply(input);
    if (id === PART_AGENDAR_ID) return runChoice("part_agendar", ctx);
    if (id === "nav_back") return sendParticularMenu(ctx);
    return NOT_HANDLED;
  }

  // Dados da avaliação particular: a próxima mensagem vai junto para a equipe.
  if (last === PARTICULAR_COLETA_INTENT && normalizeMenuText(params.body)) {
    const reply = await handoff(params.conversationId, ESCALATION_PARTICULAR_AGENDAR, `${PARTICULAR_AGENDAR_OBRIGADO} em horário comercial. 🤝`);
    return { handled: true, replyMessage: reply, intent: "particular_agendar" };
  }

  return NOT_HANDLED;
}
