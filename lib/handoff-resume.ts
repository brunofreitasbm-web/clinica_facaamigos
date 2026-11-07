// lib/handoff-resume.ts
// Retomada do fluxo depois do pedido de atendente (ver lib/handoff-resume-pure.ts para as
// regras e a migration 20261107120000 para as colunas).
//
//  1. `captureResumeSnapshot`  — chamado no escalonamento, ANTES de a sessão ser zerada.
//  2. `runHandoffResumeTick`   — cron (*/5): oferece "quer continuar?" e avisa a equipe do SLA.
//  3. `handleResumeReply`      — roteador (lib/twilio.ts), antes do gate humano: SIM/MENU.
//
// Nada aqui religa o bot sozinho: só a resposta do lead ao convite faz isso.

import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { buildMessagePreview, formatE164Phone } from "@/lib/twilio";
import { sendWhatsApp } from "@/lib/whatsapp";
import { isWhatsAppWindowOpen } from "@/lib/whatsapp-window";
import {
  DEFAULT_HANDOFF_RESUME_MINUTES,
  DEFAULT_PENDING_SLA_MINUTES,
  OUT_OF_RESUME_REPLY,
  PENDING_WAIT_REPLY,
  RESUME_OFFER_TEXT,
  RESUME_YES_INTRO,
  buildResumeSnapshot,
  decideResumeOffer,
  parseResumeReply,
  resumeQuestionFor,
  shouldAlertPendingSla,
  type ResumeSnapshot,
  type SessionRow,
} from "@/lib/handoff-resume-pure";
import { EVAL_BUTTON_YES } from "@/lib/evaluation-offer-reply-pure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const db = (): Loose => createAdminClient();

/** Foto da sessão do telefone (ou `null` se não há etapa que valha retomar). Nunca lança. */
export async function captureResumeSnapshot(phone: string): Promise<ResumeSnapshot | null> {
  try {
    const e164 = formatE164Phone(phone.replace("whatsapp:", ""));
    const { data } = await db()
      .from("chatbot_sessions")
      .select("current_step, flow, lead_id, collected_data")
      .eq("phone_number", e164)
      .maybeSingle();
    return buildResumeSnapshot(data as SessionRow | null, new Date().toISOString());
  } catch (err) {
    console.error("[Handoff Resume] falha ao capturar a sessão:", err);
    return null;
  }
}

async function loadSettings(): Promise<{ resumeMinutes: number; slaMinutes: number }> {
  const { data } = await db()
    .from("chatbot_settings")
    .select("handoff_resume_minutes, pending_sla_minutes")
    .eq("clinic_id", DEV_CLINIC_ID)
    .maybeSingle();
  // Coluna ausente (migration ainda não aplicada) ou linha nova: usa o padrão. `0` desliga.
  const resume = data?.handoff_resume_minutes;
  const sla = data?.pending_sla_minutes;
  return {
    resumeMinutes: typeof resume === "number" ? resume : DEFAULT_HANDOFF_RESUME_MINUTES,
    slaMinutes: typeof sla === "number" ? sla : DEFAULT_PENDING_SLA_MINUTES,
  };
}

async function lastHumanOutboundAt(conversationId: string): Promise<string | null> {
  const { data } = await db()
    .from("messages")
    .select("sent_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .eq("sender_type", "agent")
    .order("sent_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.sent_at as string | undefined) ?? null;
}

async function sendBotText(conv: { id: string; phone_number: string; patient_id: string | null; guardian_id: string | null }, text: string, intent: string) {
  const send = await sendWhatsApp({ to: conv.phone_number, message: text });
  try {
    const admin = db();
    await admin.from("messages").insert({
      patient_id: conv.patient_id,
      guardian_id: conv.guardian_id,
      conversation_id: conv.id,
      sender_type: "bot",
      channel: "whatsapp",
      direction: "outbound",
      body: text,
      sent_at: new Date().toISOString(),
      twilio_sid: send.messageId ?? null,
      delivery_status: send.success ? "sent" : "failed",
      intent,
    });
    await admin.from("twilio_conversations").update({ last_message_preview: buildMessagePreview(text) }).eq("id", conv.id);
  } catch (err) {
    console.error("[Handoff Resume] falha ao registrar a mensagem:", err);
  }
  return send.success;
}

type PendingConversation = {
  id: string;
  phone_number: string;
  patient_id: string | null;
  guardian_id: string | null;
  escalated_at: string | null;
  handoff_resume: ResumeSnapshot | null;
  assigned_to: string | null;
  pending_sla_notified_at: string | null;
};

/** Cron: convite de retomada + alerta de SLA. Idempotente (marca `offered_at` / `pending_sla_notified_at`). */
export async function runHandoffResumeTick(nowMs: number = Date.now()): Promise<{ offered: number; slaAlerts: number; skipped: number }> {
  const result = { offered: 0, slaAlerts: 0, skipped: 0 };
  const settings = await loadSettings();
  if (!(settings.resumeMinutes > 0) && !(settings.slaMinutes > 0)) return result;

  const { isWithinBusinessHoursNow } = await import("@/lib/twilio-faq-bot");
  const withinBusinessHours = await isWithinBusinessHoursNow(DEV_CLINIC_ID);
  // Fora do expediente nada acontece: a conta do tempo só vale com a recepção online.
  if (!withinBusinessHours) return result;

  const { data } = await db()
    .from("twilio_conversations")
    .select("id, phone_number, patient_id, guardian_id, escalated_at, handoff_resume, assigned_to, pending_sla_notified_at")
    .eq("status", "pending")
    .eq("is_bot_active", false)
    .not("escalated_at", "is", null)
    .order("escalated_at", { ascending: true })
    .limit(100);

  for (const conv of (data ?? []) as PendingConversation[]) {
    try {
      const humanAt = await lastHumanOutboundAt(conv.id);
      const humanAttending = Boolean(conv.assigned_to);
      const windowOpen = await isWhatsAppWindowOpen(conv.phone_number, nowMs);
      let offeredNow = false;

      const offer = decideResumeOffer({
        snapshot: conv.handoff_resume,
        escalatedAt: conv.escalated_at,
        nowMs,
        minutes: settings.resumeMinutes,
        lastHumanOutboundAt: humanAt,
        humanAttending,
        withinBusinessHours,
        windowOpen,
      });
      if (offer.offer && conv.handoff_resume) {
        // Marca ANTES de enviar: se o envio falhar não insiste (um convite por escalonamento).
        const marked: ResumeSnapshot = { ...conv.handoff_resume, offered_at: new Date(nowMs).toISOString() };
        const { data: claimed } = await db()
          .from("twilio_conversations")
          .update({ handoff_resume: marked })
          .eq("id", conv.id)
          .eq("is_bot_active", false)
          .select("id");
        if (claimed?.length) {
          offeredNow = await sendBotText(conv, RESUME_OFFER_TEXT, "retomada_fluxo_convite");
          if (offeredNow) result.offered += 1;
        }
      }

      if (
        shouldAlertPendingSla({
          escalatedAt: conv.escalated_at,
          nowMs,
          minutes: settings.slaMinutes,
          lastHumanOutboundAt: humanAt,
          humanAttending,
          withinBusinessHours,
          alreadyNotified: Boolean(conv.pending_sla_notified_at),
        })
      ) {
        await db().from("twilio_conversations").update({ pending_sla_notified_at: new Date(nowMs).toISOString() }).eq("id", conv.id);
        // O alerta da equipe é sempre; o aviso ao lead só quando ele não recebeu o convite agora.
        const { notifyStaffOfConversation } = await import("@/lib/web-push");
        await notifyStaffOfConversation(conv.id);
        if (!offeredNow && windowOpen) await sendBotText(conv, PENDING_WAIT_REPLY, "pendente_sla_espera");
        result.slaAlerts += 1;
      }

      if (!offer.offer && result.slaAlerts === 0) result.skipped += 1;
    } catch (err) {
      console.error("[Handoff Resume] conversa", conv.id, err);
    }
  }
  return result;
}

export type ResumeReplyResult = { handled: boolean; replyMessage: string; intent: string };

/**
 * Resposta do lead ao convite "quer continuar de onde paramos?". Devolve `null` quando a
 * mensagem não é resposta ao convite (segue o roteador normal). SIM e MENU religam o bot
 * mas MANTÊM a conversa em `pending`: a recepção continua vendo o pedido na fila.
 */
export async function handleResumeReply(params: { conversationId: string; phone: string; body: string }): Promise<ResumeReplyResult | null> {
  const admin = db();
  const { data: conv } = await admin
    .from("twilio_conversations")
    .select("id, phone_number, patient_id, guardian_id, escalated_at, handoff_resume")
    .eq("id", params.conversationId)
    .maybeSingle();
  const snapshot = conv?.handoff_resume as ResumeSnapshot | null | undefined;
  if (!conv || !snapshot?.offered_at) return null;

  const reply = parseResumeReply(params.body);
  if (reply === "other") return null;

  // Humano falou depois do escalonamento: o convite perdeu o sentido, a equipe conduz.
  const humanAt = await lastHumanOutboundAt(conv.id);
  const escalated = conv.escalated_at ? Date.parse(conv.escalated_at) : NaN;
  if (humanAt && Number.isFinite(escalated) && Date.parse(humanAt) >= escalated) {
    await admin.from("twilio_conversations").update({ handoff_resume: null }).eq("id", conv.id);
    return null;
  }

  const phone = formatE164Phone(params.phone.replace("whatsapp:", ""));
  const clear = { handoff_resume: null, is_bot_active: true };

  if (reply === "menu") {
    await admin.from("twilio_conversations").update(clear).eq("id", conv.id);
    const { sendMainMenu } = await import("@/lib/welcome-menu");
    const menu = await sendMainMenu({ phone, conversationId: conv.id });
    return { handled: true, replyMessage: menu.replyMessage, intent: "menu_inicial" };
  }

  // SIM: restaura a sessão e repete a pergunta da etapa.
  await admin.from("twilio_conversations").update(clear).eq("id", conv.id);
  await admin
    .from("chatbot_sessions")
    .upsert(
      {
        phone_number: phone,
        current_step: snapshot.step,
        flow: snapshot.flow,
        lead_id: snapshot.lead_id,
        collected_data: snapshot.collected_data ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone_number" },
    );

  if (snapshot.flow) {
    // Oferta de horários: reenvia a lista pelo próprio bot (mesmo caminho do botão "Ver horários").
    const { processEvaluationOfferStep } = await import("@/lib/evaluation-offer");
    await sendBotText(conv, RESUME_YES_INTRO, "retomada_fluxo");
    const offer = await processEvaluationOfferStep({ from: phone, body: "", buttonPayload: EVAL_BUTTON_YES });
    if (offer.handled) return { handled: true, replyMessage: offer.replyMessage, intent: "retomada_fluxo" };
    return { handled: true, replyMessage: OUT_OF_RESUME_REPLY, intent: "retomada_fluxo_indisponivel" };
  }

  const question = resumeQuestionFor(snapshot.step, snapshot.collected_data);
  if (!question) return { handled: true, replyMessage: OUT_OF_RESUME_REPLY, intent: "retomada_fluxo_indisponivel" };
  return { handled: true, replyMessage: `${RESUME_YES_INTRO}\n\n${question}`, intent: "retomada_fluxo" };
}
