// lib/evaluation-offer.ts
// Fluxo automático "plano autorizou → 3 horários → supervisão confirma" da 1ª
// avaliação, via WhatsApp (Twilio):
//
//   1. startEvaluationOffer: ao clicar "Plano autorizou", manda um TEMPLATE
//      (fora da janela de 24h) com os botões "Quero agendar" / "Agora não".
//   2. processEvaluationOfferStep: trata as respostas do responsável. "Quero
//      agendar" → menu com 3 horários (preenchimento de turno); escolha →
//      reserva atômica (RPC book_evaluation_offer_slot_atomic) → card
//      provisório na Agenda 1ª Avaliação; "Nenhum serve" → próximos 3.
//   3. A Supervisão confirma/recusa em app/supervisao (RPCs
//      confirm_evaluation_offer / reject_evaluation_offer).
//   4. tickEvaluationOffers (cron): lembrete com 24h, expira com 48h.
//
// Estado vive em `evaluation_offers` (migration 20261029130000) e na sessão
// do telefone em `chatbot_sessions` (flow = 'eval_offer', lead_id sempre
// null — um lead_id velho de outro fluxo desviaria a resposta pro bot errado).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { buildMessagePreview, findOrCreateConversation, formatE164Phone, getTwilioContentSidForCategory } from "@/lib/twilio";
import { sendWhatsApp } from "@/lib/whatsapp";
import { notifyRolesPush } from "@/lib/web-push";
import { computeEvaluationOfferSlots, type EvaluationOfferSlot } from "@/lib/evaluation-offer-slots";
import { isPhoneFreeForOffer } from "@/lib/evaluation-offer-session-pure";
import { parseInterestReply, parseSlotReply } from "@/lib/evaluation-offer-reply-pure";

export const EVAL_OFFER_FLOW = "eval_offer";
const STEP_INTEREST = "eval_offer_awaiting_interest";
const STEP_CHOICE = "eval_offer_awaiting_choice";

/** Assinatura que fecha todas as mensagens (e os templates) deste fluxo. */
export const BRAND_LINE = "FaçaAmigos - Centro de Terapia Comportamental";

// 23h, não 24h: o lembrete precisa sair DENTRO da janela de 24h do WhatsApp (contada
// desde a última mensagem do responsável); o cron roda a cada 30min, então ainda
// sobra margem antes de a janela fechar.
const REMINDER_AFTER_MS = 23 * 60 * 60 * 1000;
const EXPIRE_AFTER_MS = 48 * 60 * 60 * 1000;
const MAX_INVALID_REPLIES = 2;

// `evaluation_offers` ainda não está em lib/database.types.ts (migration
// 20261029130000 precisa ser aplicada e os tipos regenerados).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = SupabaseClient<any>;
const loose = () => createAdminClient() as unknown as Loose;

type OfferRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  phone_e164: string;
  status: string;
  offered_slots: EvaluationOfferSlot[] | null;
  page: number;
  invalid_attempts: number;
  sent_at: string | null;
  reminder_sent_at: string | null;
};

export type StartOfferResult =
  | { status: "sent"; offerId: string }
  | { status: "duplicate"; offerId: string }
  | { status: "no_phone" | "no_slots" | "busy" | "failed"; offerId?: string; error: string };

// ---------------------------------------------------------------------------
// Envio + log
// ---------------------------------------------------------------------------

async function sendAndLog(params: {
  patientId: string;
  phoneE164: string;
  text: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: number }> {
  const admin = createAdminClient();
  const send = await sendWhatsApp({
    to: params.phoneE164,
    message: params.text,
    ...(params.contentSid ? { contentSid: params.contentSid, contentVariables: params.contentVariables } : {}),
  });

  try {
    const conversation = await findOrCreateConversation({ phoneNumber: params.phoneE164, patientId: params.patientId });
    await admin.from("messages").insert({
      patient_id: params.patientId,
      conversation_id: conversation.id,
      sender_type: "bot",
      channel: "whatsapp",
      direction: "outbound",
      body: params.text,
      sent_at: new Date().toISOString(),
      twilio_sid: send.messageId ?? null,
      delivery_status: send.success ? "sent" : "failed",
    });
    await admin.from("twilio_conversations").update({ last_message_preview: buildMessagePreview(params.text) }).eq("id", conversation.id);
  } catch (err) {
    console.error("[Evaluation Offer] Falha ao registrar mensagem:", err);
  }

  return { success: send.success, messageId: send.messageId, error: send.error, errorCode: send.errorCode };
}

function firstName(full: string | null | undefined, fallback: string): string {
  return (full ?? "").trim().split(/\s+/)[0] || fallback;
}

/** Tempo desde o último contato: o mais recente entre o envio da oferta e a última mensagem do responsável. */
async function msSinceLastContact(admin: Loose, row: OfferRow, nowMs: number): Promise<number> {
  const { data } = await admin
    .from("twilio_conversations")
    .select("last_inbound_at")
    .eq("phone_number", row.phone_e164)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastInbound = data?.last_inbound_at ? Date.parse(data.last_inbound_at as string) : 0;
  return nowMs - Math.max(Date.parse(row.sent_at as string), lastInbound);
}

/** Primeiro nome do responsável (financeiro primeiro) e nome da criança, para as variáveis dos templates. */
async function getOfferNames(admin: Loose, patientId: string): Promise<{ guardianName: string; childName: string }> {
  const [{ data: patient }, { data: guardians }] = await Promise.all([
    admin.from("patients").select("full_name").eq("id", patientId).maybeSingle(),
    admin.from("guardians").select("full_name, is_financial").eq("patient_id", patientId),
  ]);
  const list = (guardians ?? []) as { full_name: string | null; is_financial: boolean | null }[];
  const guardian = list.find((g) => g.is_financial && g.full_name) ?? list.find((g) => g.full_name);
  return {
    guardianName: firstName(guardian?.full_name, "responsável"),
    childName: (patient as { full_name?: string } | null)?.full_name ?? "seu(sua) filho(a)",
  };
}

/**
 * Menu de horários. Com exatamente 3 horários e o Content SID de lista
 * configurado, vai como list-picker (variáveis: 1 = texto, 2..4 = títulos dos
 * horários; IDs fixos slot_1..3, none, human). Com 1–2 horários (ou sem o
 * template) vai como texto numerado — o parser aceita os dois jeitos.
 */
async function sendSlotList(offer: OfferRow, slots: EvaluationOfferSlot[], intro: string) {
  const listSid = process.env.TWILIO_EVAL_SLOTLIST_CONTENT_SID;
  const numbered =
    `${intro}\n\n` +
    slots.map((s) => `*${s.index}* - ${s.label}`).join("\n") +
    `\n*${slots.length + 1}* - Nenhum serve, ver outros horários` +
    `\n\nResponda apenas com o *número*.\n\n${BRAND_LINE}`;

  if (listSid && slots.length === 3) {
    return sendAndLog({
      patientId: offer.patient_id,
      phoneE164: offer.phone_e164,
      text: numbered,
      contentSid: listSid,
      contentVariables: { "1": intro, "2": slots[0].label, "3": slots[1].label, "4": slots[2].label },
    });
  }
  return sendAndLog({ patientId: offer.patient_id, phoneE164: offer.phone_e164, text: numbered });
}

// ---------------------------------------------------------------------------
// 1. Disparo
// ---------------------------------------------------------------------------

export async function startEvaluationOffer(params: {
  patientId: string;
  draftId?: string | null;
  clinicId?: string;
}): Promise<StartOfferResult> {
  const admin = loose();
  const clinicId = params.clinicId ?? DEV_CLINIC_ID;

  // Idempotência: uma oferta viva por criança (índice único parcial garante no banco).
  const { data: existing } = await admin
    .from("evaluation_offers")
    .select("id")
    .eq("patient_id", params.patientId)
    .in("status", ["aguardando_interesse", "aguardando_escolha", "aguardando_supervisor"])
    .limit(1)
    .maybeSingle();
  if (existing) return { status: "duplicate", offerId: existing.id };

  const [{ data: patient }, { data: guardians }, draftRes] = await Promise.all([
    admin.from("patients").select("full_name").eq("id", params.patientId).maybeSingle(),
    admin.from("guardians").select("full_name, phone, is_financial").eq("patient_id", params.patientId),
    params.draftId ? admin.from("registration_drafts").select("source_phone").eq("id", params.draftId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const guardianList = (guardians ?? []) as { full_name: string | null; phone: string | null; is_financial: boolean | null }[];
  const guardian = guardianList.find((g) => g.is_financial && g.phone) ?? guardianList.find((g) => g.phone);
  const phone = formatE164Phone(guardian?.phone ?? (draftRes.data as { source_phone?: string } | null)?.source_phone ?? "");
  const childName = (patient as { full_name?: string } | null)?.full_name ?? "seu(sua) filho(a)";

  const recordFailure = async (status: "falhou" | "sem_horario", error: string) => {
    const { data } = await admin
      .from("evaluation_offers")
      .insert({ clinic_id: clinicId, patient_id: params.patientId, draft_id: params.draftId ?? null, phone_e164: phone || "-", status, last_error: error })
      .select("id")
      .maybeSingle();
    return data?.id as string | undefined;
  };

  if (!phone) {
    const offerId = await recordFailure("falhou", "Responsável sem telefone cadastrado.");
    return { status: "no_phone", offerId, error: "Responsável sem telefone cadastrado." };
  }

  const { data: session } = await admin.from("chatbot_sessions").select("current_step, flow, updated_at").eq("phone_number", phone).maybeSingle();
  const free = isPhoneFreeForOffer(session, EVAL_OFFER_FLOW, Date.now());
  if (!free) {
    const error = "Este telefone está em outro atendimento automático no momento.";
    const offerId = await recordFailure("falhou", error);
    return { status: "busy", offerId, error };
  }

  const probe = await computeEvaluationOfferSlots(admin, clinicId, { page: 0 });
  if (probe.length === 0) {
    const error = "Nenhum horário livre de avaliação nos próximos 21 dias.";
    const offerId = await recordFailure("sem_horario", error);
    return { status: "no_slots", offerId, error };
  }

  const now = Date.now();
  const { data: offer, error: insertError } = await admin
    .from("evaluation_offers")
    .insert({
      clinic_id: clinicId,
      patient_id: params.patientId,
      draft_id: params.draftId ?? null,
      phone_e164: phone,
      status: "aguardando_interesse",
      sent_at: new Date(now).toISOString(),
      expires_at: new Date(now + EXPIRE_AFTER_MS).toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (insertError || !offer) {
    // 23505 = outra chamada simultânea criou a oferta viva primeiro.
    if (insertError?.code === "23505") {
      const { data: winner } = await admin.from("evaluation_offers").select("id").eq("patient_id", params.patientId).in("status", ["aguardando_interesse", "aguardando_escolha", "aguardando_supervisor"]).limit(1).maybeSingle();
      if (winner) return { status: "duplicate", offerId: winner.id };
    }
    return { status: "failed", error: "Não foi possível registrar a oferta." };
  }

  const guardianName = firstName(guardian?.full_name, "responsável");
  const text =
    `Olá, ${guardianName}! 💙\n\n` +
    `O plano de saúde autorizou o atendimento de *${childName}* no FaçaAmigos.\n\n` +
    `Podemos agendar a 1ª avaliação agora? Responda *1* para escolher um horário, ou *2* se preferir deixar para depois.\n\n${BRAND_LINE}`;

  const contentSid = getTwilioContentSidForCategory("agendamento_avaliacao");
  const send = await sendAndLog({
    patientId: params.patientId,
    phoneE164: phone,
    text,
    ...(contentSid ? { contentSid, contentVariables: { "1": guardianName, "2": childName } } : {}),
  });

  if (!send.success) {
    const error = contentSid
      ? (send.error ?? "Falha ao enviar o template.")
      : "Template de abertura não configurado (TWILIO_EVAL_OFFER_TEMPLATE_CONTENT_SID) e a janela de 24h está fechada.";
    await admin.from("evaluation_offers").update({ status: "falhou", last_error: error, updated_at: new Date().toISOString() }).eq("id", offer.id);
    return { status: "failed", offerId: offer.id, error };
  }

  await admin.from("evaluation_offers").update({ first_message_sid: send.messageId ?? null, updated_at: new Date().toISOString() }).eq("id", offer.id);
  await admin.from("chatbot_sessions").upsert(
    {
      phone_number: phone,
      flow: EVAL_OFFER_FLOW,
      lead_id: null,
      current_step: STEP_INTEREST,
      collected_data: { offer_id: offer.id, child_name: childName },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" },
  );

  return { status: "sent", offerId: offer.id };
}

// ---------------------------------------------------------------------------
// 2. Respostas do responsável
// ---------------------------------------------------------------------------

export type EvaluationOfferBotResult = { handled: boolean; replyMessage: string };

async function setSessionIdle(phone: string) {
  await createAdminClient()
    .from("chatbot_sessions")
    .update({ current_step: "idle", flow: null, lead_id: null, collected_data: {}, updated_at: new Date().toISOString() })
    .eq("phone_number", phone);
}

async function escalateToHuman(phone: string, reason: string) {
  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("twilio_conversations")
    .select("id")
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (conversation) {
    const { escalateConversation } = await import("@/lib/twilio-faq-bot");
    await escalateConversation(conversation.id, "pediu_humano").catch((err) => console.error("[Evaluation Offer] escalonamento:", reason, err));
  }
  // Sessão livre: a conversa passa a ser do atendente.
  await setSessionIdle(phone);
}

export async function processEvaluationOfferStep(params: {
  from: string;
  body: string;
  buttonPayload?: string | null;
  listId?: string | null;
}): Promise<EvaluationOfferBotResult> {
  const NOT_HANDLED: EvaluationOfferBotResult = { handled: false, replyMessage: "" };
  const phone = formatE164Phone(params.from.replace("whatsapp:", ""));
  const admin = loose();

  const { data: session } = await admin.from("chatbot_sessions").select("*").eq("phone_number", phone).maybeSingle();
  if (!session || session.flow !== EVAL_OFFER_FLOW) return NOT_HANDLED;

  const offerId = (session.collected_data as { offer_id?: string } | null)?.offer_id;
  const { data: offer } = offerId ? await admin.from("evaluation_offers").select("*").eq("id", offerId).maybeSingle() : { data: null };
  const row = offer as OfferRow | null;

  // Oferta sumiu ou já terminou (expirou, cancelada, confirmada): libera a sessão e deixa os outros bots responderem.
  if (!row || !["aguardando_interesse", "aguardando_escolha", "aguardando_supervisor"].includes(row.status)) {
    await setSessionIdle(phone);
    return NOT_HANDLED;
  }

  const touch = (patch: Record<string, unknown>) =>
    admin.from("evaluation_offers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", row.id);

  const registerInvalid = async (hint: string): Promise<EvaluationOfferBotResult> => {
    const attempts = row.invalid_attempts + 1;
    await touch({ invalid_attempts: attempts });
    if (attempts > MAX_INVALID_REPLIES) {
      await escalateToHuman(phone, "respostas_invalidas");
      return { handled: true, replyMessage: "Não consegui entender sua resposta. 💙 Vou chamar um atendente da nossa equipe para te ajudar por aqui." };
    }
    return { handled: true, replyMessage: hint };
  };

  const cancel = async (): Promise<EvaluationOfferBotResult> => {
    await touch({ status: "cancelado" });
    await setSessionIdle(phone);
    return { handled: true, replyMessage: "Tudo bem! 💙 Quando quiser agendar a 1ª avaliação, é só nos chamar por aqui." };
  };

  // --- Passo 1: quer agendar? -------------------------------------------------
  if (session.current_step === STEP_INTEREST) {
    const reply = parseInterestReply({ body: params.body, buttonPayload: params.buttonPayload });
    if (reply.kind === "stop" || reply.kind === "no") return cancel();
    if (reply.kind !== "yes") {
      return registerInvalid("Para agendar a 1ª avaliação, responda *1*. Se preferir deixar para depois, responda *2*.");
    }

    const slots = await computeEvaluationOfferSlots(admin, row.clinic_id, { page: 0 });
    if (slots.length === 0) {
      await touch({ status: "sem_horario", last_error: "Nenhum horário livre no momento da resposta." });
      await setSessionIdle(phone);
      return { handled: true, replyMessage: "No momento não temos horários livres para a 1ª avaliação. 💙 Nossa equipe vai entrar em contato assim que abrir uma vaga." };
    }

    await touch({ status: "aguardando_escolha", offered_slots: slots, page: 0, invalid_attempts: 0 });
    await admin.from("chatbot_sessions").update({ current_step: STEP_CHOICE, updated_at: new Date().toISOString() }).eq("phone_number", phone);
    await sendSlotList(row, slots, "Ótimo! 💙 Escolha o melhor horário para a 1ª avaliação:");
    return { handled: true, replyMessage: "" };
  }

  // --- Passo 2: escolha do horário --------------------------------------------
  if (session.current_step === STEP_CHOICE) {
    const slots = row.offered_slots ?? [];
    const reply = parseSlotReply({ body: params.body, buttonPayload: params.buttonPayload, listId: params.listId }, slots);

    if (reply.kind === "stop") return cancel();
    if (reply.kind === "resend") {
      await sendSlotList(row, slots, "Estes são os horários disponíveis para a 1ª avaliação:");
      return { handled: true, replyMessage: "" };
    }
    if (reply.kind === "human") {
      await escalateToHuman(phone, "pediu_humano");
      return { handled: true, replyMessage: "Certo! 💙 Vou chamar um atendente da nossa equipe para te ajudar por aqui." };
    }

    if (reply.kind === "none") {
      const nextPage = row.page + 1;
      const next = await computeEvaluationOfferSlots(admin, row.clinic_id, { page: nextPage });
      if (next.length === 0) {
        await escalateToHuman(phone, "sem_mais_horarios");
        return { handled: true, replyMessage: "Esses eram todos os horários livres no momento. 💙 Vou chamar um atendente para encontrar a melhor opção para vocês." };
      }
      await touch({ offered_slots: next, page: nextPage, invalid_attempts: 0 });
      await sendSlotList({ ...row, page: nextPage }, next, "Claro! Aqui estão outras opções:");
      return { handled: true, replyMessage: "" };
    }

    if (reply.kind === "slot") {
      const chosen = slots.find((s) => s.index === reply.index);
      if (!chosen) return registerInvalid("Responda apenas com o *número* do horário desejado.");

      const { data: booking } = await admin.rpc("book_evaluation_offer_slot_atomic", {
        p_offer_id: row.id,
        p_therapist_id: chosen.therapist_id,
        p_room_id: chosen.room_id,
        p_starts_at: chosen.starts_at,
        p_ends_at: chosen.ends_at,
      });
      const result = booking as { success: boolean; conflict?: boolean; error?: string } | null;

      if (result?.success) {
        await setSessionIdle(phone);
        // Aviso à supervisão e à gestão: um horário escolhido espera o OK. Sem nome na tela bloqueada.
        await notifyRolesPush({
          roles: ["supervisor", "gestor"],
          title: "Horário escolhido",
          body: "Um responsável escolheu o horário da 1ª avaliação. Confirme na agenda.",
          url: "/supervisao",
        });
        return {
          handled: true,
          replyMessage:
            `⏳ *Horário reservado!*\n\n📅 ${chosen.label}\n\n` +
            `Nossa supervisão vai confirmar em instantes e você receberá a confirmação final por aqui. 💙`,
        };
      }

      if (result?.conflict) {
        // Horário tomado por outra família (ou fora da janela): recalcula a lista em vez de repetir a velha.
        const fresh = await computeEvaluationOfferSlots(admin, row.clinic_id, { page: 0 });
        if (fresh.length === 0) {
          await escalateToHuman(phone, "sem_mais_horarios");
          return { handled: true, replyMessage: "Esse horário acabou de ser reservado e não temos outros livres agora. 💙 Vou chamar um atendente para te ajudar." };
        }
        await touch({ offered_slots: fresh, page: 0, invalid_attempts: 0 });
        await sendSlotList(row, fresh, "⚠️ Esse horário acabou de ser reservado por outra família. Estas são as opções livres agora:");
        return { handled: true, replyMessage: "" };
      }

      return { handled: true, replyMessage: "Não consegui reservar agora. 💙 Tente novamente em instantes, ou responda *ATENDENTE*." };
    }

    return registerInvalid("Responda apenas com o *número* do horário desejado (ou toque em *Ver horários*).");
  }

  // Oferta aguardando a supervisão: o responsável escreveu de novo.
  return NOT_HANDLED;
}

// ---------------------------------------------------------------------------
// 3. Supervisão
// ---------------------------------------------------------------------------

export async function getActiveOfferForAppointment(appointmentId: string): Promise<{ id: string; patient_id: string } | null> {
  const { data } = await loose()
    .from("evaluation_offers")
    .select("id, patient_id")
    .eq("appointment_id", appointmentId)
    .eq("status", "aguardando_supervisor")
    .maybeSingle();
  return data ?? null;
}

/**
 * Cancela a oferta que ainda espera o responsável (convite ou escolha do horário)
 * e libera o telefone no bot. O update é condicional ao status: se o responsável
 * escolheu um horário no meio do caminho, nada é cancelado.
 */
export async function cancelEvaluationOffer(offerId: string): Promise<{ success: boolean; error?: string }> {
  const admin = loose();
  const { data: cancelled } = await admin
    .from("evaluation_offers")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .in("status", ["aguardando_interesse", "aguardando_escolha"])
    .select("phone_e164");
  const row = (cancelled as { phone_e164: string }[] | null)?.[0];
  if (!row) return { success: false, error: "Esta oferta não está mais aguardando o responsável." };

  await admin
    .from("chatbot_sessions")
    .update({ current_step: "idle", flow: null, lead_id: null, collected_data: {}, updated_at: new Date().toISOString() })
    .eq("phone_number", row.phone_e164)
    .eq("flow", EVAL_OFFER_FLOW);
  return { success: true };
}

/**
 * Chamado antes de qualquer agendamento manual de 1ª avaliação: a oferta
 * automática viva da criança é cancelada, senão o responsável ainda poderia
 * escolher um horário (2ª avaliação) e receber lembrete/confirmação em dobro.
 * Se ele já escolheu (aguardando_supervisor), já existe um horário reservado: recusa.
 */
export async function releaseOfferForManualScheduling(patientId: string): Promise<{ success: true } | { success: false; error: string }> {
  const { data } = await loose()
    .from("evaluation_offers")
    .select("id, status")
    .eq("patient_id", patientId)
    .in("status", ["aguardando_interesse", "aguardando_escolha", "aguardando_supervisor"])
    .limit(1)
    .maybeSingle();
  const live = data as { id: string; status: string } | null;
  if (!live) return { success: true };

  const blocked = {
    success: false as const,
    error: "O responsável já escolheu um horário pelo WhatsApp. Confirme ou recuse o card provisório na grade.",
  };
  if (live.status === "aguardando_supervisor") return blocked;

  const cancelled = await cancelEvaluationOffer(live.id);
  // Falhou o cancelamento = o responsável escolheu no meio do caminho.
  return cancelled.success ? { success: true } : blocked;
}

/** Depois que a supervisão recusa: gera e envia uma nova lista ao responsável. */
export async function reofferAfterRejection(offerId: string): Promise<{ success: boolean; error?: string }> {
  const admin = loose();
  const { data } = await admin.from("evaluation_offers").select("*").eq("id", offerId).maybeSingle();
  const row = data as OfferRow | null;
  if (!row || row.status !== "aguardando_escolha") return { success: false, error: "Oferta não está aguardando escolha." };

  const slots = await computeEvaluationOfferSlots(admin, row.clinic_id, { page: 0 });
  if (slots.length === 0) return { success: false, error: "Nenhum horário livre para reofertar." };

  await admin.from("evaluation_offers").update({ offered_slots: slots, page: 0, updated_at: new Date().toISOString() }).eq("id", offerId);
  await admin.from("chatbot_sessions").upsert(
    { phone_number: row.phone_e164, flow: EVAL_OFFER_FLOW, lead_id: null, current_step: STEP_CHOICE, collected_data: { offer_id: offerId }, updated_at: new Date().toISOString() },
    { onConflict: "phone_number" },
  );
  const send = await sendSlotList(row, slots, "Precisamos reagendar a 1ª avaliação. 💙 Estas são as novas opções:");
  return send.success ? { success: true } : { success: false, error: send.error };
}

// ---------------------------------------------------------------------------
// 4. Cron: lembrete (24h) e expiração (48h)
// ---------------------------------------------------------------------------

export async function tickEvaluationOffers(nowMs: number = Date.now()): Promise<{ reminded: number; expired: number }> {
  const admin = loose();
  const { data } = await admin
    .from("evaluation_offers")
    .select("*")
    .in("status", ["aguardando_interesse", "aguardando_escolha"])
    .not("sent_at", "is", null);
  const rows = (data ?? []) as OfferRow[];

  let reminded = 0;
  let expired = 0;
  for (const row of rows) {
    const age = nowMs - new Date(row.sent_at as string).getTime();

    if (age >= EXPIRE_AFTER_MS) {
      await admin.from("evaluation_offers").update({ status: "expirado", updated_at: new Date(nowMs).toISOString() }).eq("id", row.id);
      const { data: session } = await admin.from("chatbot_sessions").select("flow, collected_data").eq("phone_number", row.phone_e164).maybeSingle();
      if (session?.flow === EVAL_OFFER_FLOW && (session.collected_data as { offer_id?: string } | null)?.offer_id === row.id) {
        await setSessionIdle(row.phone_e164);
      }
      expired++;
      continue;
    }

    if (age >= REMINDER_AFTER_MS && !row.reminder_sent_at) {
      // Conta desde o último contato do responsável (resposta dele ou o nosso envio),
      // não só desde o template: quem acabou de responder ainda está dentro da janela.
      if ((await msSinceLastContact(admin, row, nowMs)) < REMINDER_AFTER_MS) continue;
      const { guardianName, childName } = await getOfferNames(admin, row.patient_id);
      const text =
        `Olá, ${guardianName}! 💙\n\n` +
        `Ainda aguardamos sua resposta para agendar a 1ª avaliação de *${childName}*, autorizada pelo plano de saúde. ` +
        // Em texto livre, "1" já é o 1º horário de quem recebeu a lista; os botões do template (Ver horários) valem nos dois estados.
        (row.status === "aguardando_interesse"
          ? `Responda *1* para ver os horários, ou *2* se preferir deixar para depois.`
          : `Os horários continuam disponíveis: responda com o *número* do horário que preferir.`) +
        `\n\n${BRAND_LINE}`;
      const contentSid = getTwilioContentSidForCategory("lembrete_avaliacao");
      const send = await sendAndLog({
        patientId: row.patient_id,
        phoneE164: row.phone_e164,
        text,
        ...(contentSid ? { contentSid, contentVariables: { "1": guardianName, "2": childName } } : {}),
      });
      await admin
        .from("evaluation_offers")
        .update({ reminder_sent_at: new Date(nowMs).toISOString(), last_error: send.success ? null : (send.error ?? "Falha no lembrete."), updated_at: new Date(nowMs).toISOString() })
        .eq("id", row.id);
      if (send.success) reminded++;
    }
  }
  return { reminded, expired };
}
