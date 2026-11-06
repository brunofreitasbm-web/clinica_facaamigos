// lib/price-policy.ts
// Aplicação da regra de preço (lib/price-policy-pure.ts) no WhatsApp: lê o
// histórico da conversa, decide e executa (pergunta o tipo, envia a arte,
// transborda). Roda ANTES da IA e das regras de FAQ, então não depende do
// Gemini nem gasta cota.
//
// "Arte já enviada" não tem coluna própria: é a mensagem do bot em `messages`
// com `intent = part_valores` e `media_url` preenchido (gravada por
// sendPriceArtAndHandoff). Se o envio da imagem falhar, a linha não tem
// media_url e a arte conta como NÃO enviada.
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import {
  PRICE_ART_ALREADY_SENT_INTENT,
  PRICE_ART_ALREADY_SENT_REPLY,
  PRICE_ASK_TYPE_INTENT,
  PRICE_ASK_TYPE_QUESTION,
  PRICE_CONVENIO_INTENT,
  PRICE_CONVENIO_REPLY,
  containsMoney,
  decidePriceStep,
  inferKnownAttendanceType,
  type AttendanceType,
  type ConversationEntry,
} from "@/lib/price-policy-pure";
import { PARTICULAR_VALORES_INTENT } from "@/lib/welcome-menu-pure";

export type PriceStepResult = { handled: boolean; replyMessage: string; intent: string };

const NOT_HANDLED: PriceStepResult = { handled: false, replyMessage: "", intent: "" };

type Ctx = { phone: string; conversationId: string | null };

async function loadRecentEntries(conversationId: string): Promise<{ entries: ConversationEntry[]; lastBotIntent: string | null }> {
  const { data } = await createAdminClient()
    .from("messages")
    .select("body, sender_type, intent")
    .eq("conversation_id", conversationId)
    .eq("channel", "whatsapp")
    .order("sent_at", { ascending: false })
    .limit(12);
  const rows = data ?? [];
  const entries: ConversationEntry[] = rows.map((m) => ({
    sender: m.sender_type === "user" ? "user" : "bot",
    body: m.body ?? null,
    intent: (m.intent as string | null) ?? null,
  }));
  const lastBot = rows.find((m) => m.sender_type !== "user");
  return { entries, lastBotIntent: (lastBot?.intent as string | null | undefined) ?? null };
}

/** A arte de pacotes já foi enviada (com imagem) nesta conversa. */
export async function wasPriceArtSent(conversationId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .eq("intent", PARTICULAR_VALORES_INTENT)
    .not("media_url", "is", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Convênio já identificado na conversa (campo preenchido pelo bot); "Particular" cadastrado como convênio conta como particular. */
async function insurerTypeOfConversation(conversationId: string): Promise<AttendanceType | null> {
  const { data } = await createAdminClient()
    .from("twilio_conversations")
    .select("insurers(name)")
    .eq("id", conversationId)
    .maybeSingle();
  const insurers = (data as { insurers?: { name?: string } | { name?: string }[] | null } | null)?.insurers;
  const name = (Array.isArray(insurers) ? insurers[0]?.name : insurers?.name)?.trim().toLowerCase();
  if (!name) return null;
  return name === "particular" ? "particular" : "convenio";
}

async function handoffText(conversationId: string | null, reason: "particular" | "pediu_humano", text: string): Promise<string> {
  if (!conversationId) return text;
  const { escalateConversation, isWithinBusinessHoursNow, OUT_OF_HOURS_ESCALATION_SUFFIX } = await import("./twilio-faq-bot");
  await escalateConversation(conversationId, reason);
  return (await isWithinBusinessHoursNow(DEV_CLINIC_ID)) ? text : text + OUT_OF_HOURS_ESCALATION_SUFFIX;
}

async function runStep(kind: "ask_type" | "send_art" | "art_already_sent" | "convenio", ctx: Ctx): Promise<PriceStepResult> {
  switch (kind) {
    case "ask_type":
      return { handled: true, replyMessage: PRICE_ASK_TYPE_QUESTION, intent: PRICE_ASK_TYPE_INTENT };
    case "convenio":
      return { handled: true, replyMessage: await handoffText(ctx.conversationId, "pediu_humano", PRICE_CONVENIO_REPLY), intent: PRICE_CONVENIO_INTENT };
    case "art_already_sent":
      return {
        handled: true,
        replyMessage: await handoffText(ctx.conversationId, "particular", PRICE_ART_ALREADY_SENT_REPLY),
        intent: PRICE_ART_ALREADY_SENT_INTENT,
      };
    case "send_art": {
      const { sendPriceArtAndHandoff } = await import("./welcome-menu");
      return sendPriceArtAndHandoff(ctx);
    }
  }
}

/**
 * Passo de preço do roteador. Devolve `handled: false` quando a mensagem não é
 * sobre preço (segue para as regras de FAQ e a IA).
 */
export async function processPriceStep(params: { phone: string; body: string; conversationId: string | null }): Promise<PriceStepResult> {
  const { phone, body, conversationId } = params;
  const ctx: Ctx = { phone, conversationId };
  if (!body.trim()) return NOT_HANDLED;

  let awaitingType = false;
  let knownType: AttendanceType | null = null;
  let artSent = false;
  if (conversationId) {
    const [{ entries, lastBotIntent }, insurerType] = await Promise.all([loadRecentEntries(conversationId), insurerTypeOfConversation(conversationId)]);
    awaitingType = lastBotIntent === PRICE_ASK_TYPE_INTENT;
    // O que a pessoa disse por último vale mais que o convênio gravado antes.
    knownType = inferKnownAttendanceType(entries) ?? insurerType;
    artSent = await wasPriceArtSent(conversationId);
  }

  const step = decidePriceStep({ body, awaitingType, knownType, artSent });
  if (step.kind === "none") return NOT_HANDLED;
  return runStep(step.kind, ctx);
}

/**
 * Trava de saída: nenhuma resposta do bot (IA, FAQ cadastrado no banco ou regra)
 * pode levar valor em reais. Se levar, a resposta é descartada e entra a regra de
 * preço no lugar (pergunta o tipo, arte ou transbordo).
 */
export async function replacePriceLeak(params: { phone: string; body: string; reply: string; conversationId: string | null }): Promise<PriceStepResult | null> {
  if (!containsMoney(params.reply)) return null;
  console.warn("[Price Policy] Resposta com valor em texto descartada; aplicando a regra de preço.");
  const ctx: Ctx = { phone: params.phone, conversationId: params.conversationId };

  let knownType: AttendanceType | null = null;
  let artSent = false;
  if (params.conversationId) {
    const [{ entries }, insurerType] = await Promise.all([loadRecentEntries(params.conversationId), insurerTypeOfConversation(params.conversationId)]);
    knownType = inferKnownAttendanceType(entries) ?? insurerType;
    artSent = await wasPriceArtSent(params.conversationId);
  }
  // Mesmo que a pergunta não tenha cara de preço, o texto ia sair com valor: trata como pergunta de preço.
  const step = decidePriceStep({ body: `${params.body} quanto custa`, awaitingType: false, knownType, artSent });
  if (step.kind === "none") return null;
  return runStep(step.kind, ctx);
}
