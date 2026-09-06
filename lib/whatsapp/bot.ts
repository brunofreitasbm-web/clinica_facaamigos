// lib/whatsapp/bot.ts
/**
 * Máquina de estados do chatbot. `handleInbound` é chamada tanto pelo
 * webhook real (app/api/webhooks/twilio/whatsapp/route.ts) quanto pelo
 * simulador (app/gestor/integracoes/whatsapp/simulador) — os dois já
 * resolveram a conversa (upsert por clinic_id+wa_id) e gravaram a mensagem
 * inbound (com idempotência por provider_sid) antes de chamar esta função,
 * então o bot só decide a reação e envia a resposta.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getTransport } from "./transport";
import { getBotLlm } from "./llm";
import { createOrReuseLead, storeBotDocument } from "./intake";
import { getClinicEvaluationSettings, getEvaluationSlots, type EvaluationSlot } from "./slots";
import { bookEvaluation } from "./booking";
import { isValidCpf, onlyDigits, parseBrazilianBirthDate } from "./validators";
import * as copy from "./copy";
import { getAvailableSlots, rescheduleAppointmentAction, confirmAppointment } from "@/app/recepcao/agenda/session-actions";

type ConversationRow = {
  id: string;
  clinic_id: string;
  wa_id: string;
  state: string;
  context: Record<string, unknown>;
  patient_id: string | null;
  guardian_id: string | null;
  consent_at: string | null;
  human_requested_at: string | null;
};

export type NormalizedInbound = {
  text: string;
  listId: string | null;
  mediaUrl: string | null;
  mediaContentType: string | null;
};

const HUMAN_SILENCE_MS = 4 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const MAX_BOOKING_RETRIES = 3;

function admin() {
  return createAdminClient();
}

async function getConversation(conversationId: string): Promise<ConversationRow> {
  const { data, error } = await admin()
    .from("whatsapp_conversations")
    .select("id, clinic_id, wa_id, state, context, patient_id, guardian_id, consent_at, human_requested_at")
    .eq("id", conversationId)
    .single();
  if (error || !data) throw new Error("Conversa não encontrada");
  return data as ConversationRow;
}

async function patch(conversationId: string, fields: Record<string, unknown>) {
  await admin()
    .from("whatsapp_conversations")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

async function setState(conversationId: string, state: string, contextPatch: Record<string, unknown> = {}) {
  const conv = await getConversation(conversationId);
  await patch(conversationId, { state, context: { ...conv.context, ...contextPatch } });
}

async function say(conversationId: string, waId: string, body: string) {
  await getTransport(conversationId).sendText(waId, body);
}

async function isRateLimited(conversationId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin()
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .gte("created_at", since);
  return (count ?? 0) > RATE_LIMIT_MAX;
}

function digitOption(input: NormalizedInbound): string | null {
  if (input.listId) return input.listId;
  const trimmed = input.text.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

async function goToMenu(conversationId: string, waId: string) {
  await setState(conversationId, "menu");
  await say(conversationId, waId, copy.MENU_TEXT);
}

async function handleHandoff(conversationId: string, waId: string) {
  const admin_ = admin();
  await patch(conversationId, { human_requested_at: new Date().toISOString(), state: "human_handoff" });
  const { data: settings } = await admin_
    .from("clinic_settings")
    .select("opening_hours")
    .eq("clinic_id", DEV_CLINIC_ID)
    .maybeSingle();
  await say(conversationId, waId, copy.HANDOFF_TEXT_TEMPLATE(settings?.opening_hours ?? null));
}

async function sendInsurersMenu(conversationId: string, waId: string) {
  const { data } = await admin().from("insurers").select("name").eq("clinic_id", DEV_CLINIC_ID).order("name");
  await say(conversationId, waId, copy.insurersInfoText((data ?? []).map((i) => i.name)));
}

async function sendAddressInfo(conversationId: string, waId: string) {
  const { data } = await admin()
    .from("clinic_settings")
    .select("address, opening_hours")
    .eq("clinic_id", DEV_CLINIC_ID)
    .maybeSingle();
  await say(conversationId, waId, copy.addressInfoText(data?.address ?? null, data?.opening_hours ?? null));
}

async function offerSlotsNow(conversationId: string, waId: string, patientId: string, requestId: string) {
  const settings = await getClinicEvaluationSettings();
  if (!settings) {
    await say(conversationId, waId, "Ainda não temos horário de avaliação configurado — a equipe vai te chamar.");
    return;
  }
  const slots = await getEvaluationSlots(settings);
  const { data: patient } = await admin().from("patients").select("full_name").eq("id", patientId).maybeSingle();

  await setState(conversationId, "choosing_slot", {
    offered_slots: slots,
    request_id: requestId,
    booking_attempts: 0,
  });

  const items = [
    ...slots.map((s) => ({ id: s.id, title: `${s.dateLabel} ${s.timeLabel}` })),
    { id: "no_slot_fits", title: copy.NO_SLOT_FITS_OPTION },
  ];
  await getTransport(conversationId).sendListPicker(waId, {
    body: copy.slotsOfferText("", patient?.full_name ?? "seu filho(a)"),
    button: "Ver horários",
    items,
  });
}

async function handleMenuChoice(conversationId: string, waId: string, option: string | null) {
  switch (option) {
    case "1":
      await setState(conversationId, "intake_consent");
      await say(conversationId, waId, copy.CONSENT_TEXT);
      return;
    case "2":
      await sendInsurersMenu(conversationId, waId);
      return;
    case "3":
      await say(conversationId, waId, copy.DOCUMENTS_INFO_TEXT);
      return;
    case "4":
      await say(conversationId, waId, copy.EVALUATION_INFO_TEXT);
      return;
    case "5":
      await sendAddressInfo(conversationId, waId);
      return;
    case "6":
      await handleManageSessionStart(conversationId, waId);
      return;
    case "9":
      await handleHandoff(conversationId, waId);
      return;
    default: {
      const llm = getBotLlm();
      const intent = llm ? await llm.classifyIntent(waId) : null;
      const routed: Record<string, string> = {
        agendar: "1",
        convenios: "2",
        documentos: "3",
        avaliacao: "4",
        endereco: "5",
        confirmar: "6",
        reagendar: "6",
        humano: "9",
      };
      if (intent && routed[intent]) {
        await handleMenuChoice(conversationId, waId, routed[intent]);
        return;
      }
      await say(conversationId, waId, copy.NOT_UNDERSTOOD_TEXT);
    }
  }
}

async function handleConsent(conversationId: string, waId: string, option: string | null) {
  if (option === "1") {
    await setState(conversationId, "intake_guardian_name");
    await patch(conversationId, { consent_at: new Date().toISOString() });
    await say(conversationId, waId, copy.ASK_GUARDIAN_NAME_TEXT);
    return;
  }
  if (option === "2") {
    await setState(conversationId, "menu");
    await say(conversationId, waId, copy.CONSENT_DECLINED_TEXT);
    return;
  }
  await say(conversationId, waId, copy.CONSENT_TEXT);
}

async function handleInsuranceChoice(conversationId: string, waId: string, text: string) {
  const { data: insurers } = await admin().from("insurers").select("id, name").eq("clinic_id", DEV_CLINIC_ID).order("name");
  const list = insurers ?? [];
  const index = Number(text.trim());
  if (!index || Number.isNaN(index)) {
    await say(conversationId, waId, copy.askInsuranceText(list.map((i) => i.name)));
    return;
  }
  if (index >= 1 && index <= list.length) {
    await setState(conversationId, "intake_card_number", { insurer_id: list[index - 1].id, is_private: false });
    await say(conversationId, waId, copy.ASK_CARD_NUMBER_TEXT);
    return;
  }
  if (index === list.length + 1) {
    await setState(conversationId, "intake_has_docs", { insurer_id: null, is_private: true, card_number: null });
    await say(conversationId, waId, copy.ASK_HAS_DOCS_TEXT);
    return;
  }
  if (index === list.length + 2) {
    await setState(conversationId, "intake_card_number", { insurer_id: null, is_private: false, other_insurer: true });
    await say(conversationId, waId, copy.ASK_CARD_NUMBER_TEXT);
    return;
  }
  await say(conversationId, waId, copy.askInsuranceText(list.map((i) => i.name)));
}

async function startDocumentCollection(conversationId: string, waId: string, ctx: Record<string, unknown>) {
  const lead = await createOrReuseLead({
    guardianName: String(ctx.guardian_name ?? ""),
    guardianCpf: String(ctx.guardian_cpf ?? ""),
    guardianPhone: waId,
    childName: String(ctx.child_name ?? ""),
    childCpf: ctx.child_cpf ? String(ctx.child_cpf) : null,
    childBirthDate: String(ctx.child_birth_date ?? ""),
    insurerId: (ctx.insurer_id as string | null) ?? null,
    isPrivate: Boolean(ctx.is_private),
    cardNumber: (ctx.card_number as string | null) ?? null,
  });

  await patch(conversationId, { patient_id: lead.patientId, guardian_id: lead.guardianId });
  await setState(conversationId, "intake_wait_laudo", { patient_id: lead.patientId, guardian_id: lead.guardianId });
  await say(conversationId, waId, copy.ASK_LAUDO_PDF_TEXT);
}

async function handleHasDocsChoice(conversationId: string, waId: string, option: string | null, ctx: Record<string, unknown>) {
  if (option === "1") {
    await startDocumentCollection(conversationId, waId, ctx);
    return;
  }
  if (option === "2" || option === "3" || option === "4") {
    // Cria o lead mesmo sem documentos (aparece na fila da recepção), mas
    // NÃO agenda — decisão explícita do dono da clínica: laudo+guia são
    // obrigatórios pro agendamento autônomo.
    const lead = await createOrReuseLead({
      guardianName: String(ctx.guardian_name ?? ""),
      guardianCpf: String(ctx.guardian_cpf ?? ""),
      guardianPhone: waId,
      childName: String(ctx.child_name ?? ""),
      childCpf: ctx.child_cpf ? String(ctx.child_cpf) : null,
      childBirthDate: String(ctx.child_birth_date ?? ""),
      insurerId: (ctx.insurer_id as string | null) ?? null,
      isPrivate: Boolean(ctx.is_private),
      cardNumber: (ctx.card_number as string | null) ?? null,
      complaint: "sem laudo/guia",
    });
    await patch(conversationId, { patient_id: lead.patientId, guardian_id: lead.guardianId });
    await setState(conversationId, "intake_missing_docs_offer_human");
    await say(conversationId, waId, copy.MISSING_DOCS_TEXT);
    return;
  }
  await say(conversationId, waId, copy.ASK_HAS_DOCS_TEXT);
}

async function createEvaluationRequest(conversationId: string, patientId: string, guardianId: string, laudoDocId: string, guiaDocId: string) {
  const { data } = await admin()
    .from("evaluation_requests")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      conversation_id: conversationId,
      patient_id: patientId,
      guardian_id: guardianId,
      laudo_document_id: laudoDocId,
      guia_document_id: guiaDocId,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

async function handleDocumentUpload(
  conversationId: string,
  waId: string,
  conv: ConversationRow,
  input: NormalizedInbound,
  category: "laudo" | "autorizacao",
) {
  if (!input.mediaUrl) {
    await say(conversationId, waId, copy.NOT_A_PDF_TEXT);
    return;
  }
  const patientId = conv.patient_id;
  if (!patientId) {
    await say(conversationId, waId, copy.NOT_A_PDF_TEXT);
    return;
  }

  const { buffer, contentType } = await getTransport(conversationId).downloadMedia(input.mediaUrl);
  const result = await storeBotDocument({
    patientId,
    category,
    buffer,
    contentType: input.mediaContentType ?? contentType,
    fileName: `${category}.pdf`,
  });

  if ("error" in result) {
    await say(conversationId, waId, copy.NOT_A_PDF_TEXT);
    return;
  }

  const llm = getBotLlm();
  const inspection = llm ? await llm.inspectPdf(buffer, category === "laudo" ? "laudo" : "guia") : null;

  if (category === "laudo") {
    await setState(conversationId, "intake_wait_guia", { laudo_document_id: result.documentId, laudo_check: inspection });
    await say(conversationId, waId, copy.ASK_GUIA_PDF_TEXT);
    return;
  }

  const laudoDocId = String(conv.context.laudo_document_id ?? "");
  const requestId = await createEvaluationRequest(conversationId, patientId, conv.guardian_id ?? "", laudoDocId, result.documentId);
  await setState(conversationId, "awaiting_supervisor", {
    guia_document_id: result.documentId,
    guia_check: inspection,
    request_id: requestId,
  });
  await say(conversationId, waId, copy.REQUEST_RECEIVED_TEXT);
}

async function handleChoosingSlot(conversationId: string, waId: string, conv: ConversationRow, input: NormalizedInbound) {
  const offered = (conv.context.offered_slots as EvaluationSlot[] | undefined) ?? [];
  const requestId = String(conv.context.request_id ?? "");
  const choice = input.listId ?? input.text.trim();

  if (choice === "no_slot_fits" || choice.toLowerCase().includes("nenhum")) {
    await handleHandoff(conversationId, waId);
    return;
  }

  // Aceita tanto o ListId real (webhook Twilio) quanto o número de ordem
  // exibido no texto (simulador, onde não há list-picker de fato — ver
  // listAsText em lib/whatsapp/transport.ts).
  const index = Number(choice);
  const slot = offered.find((s) => s.id === choice) ?? (Number.isInteger(index) ? offered[index - 1] : undefined);
  if (!slot) {
    await say(conversationId, waId, copy.SLOT_EXPIRED_TEXT);
    await offerSlotsNow(conversationId, waId, conv.patient_id ?? "", requestId);
    return;
  }

  const settings = await getClinicEvaluationSettings();
  if (!settings || !conv.patient_id) {
    await handleHandoff(conversationId, waId);
    return;
  }

  const result = await bookEvaluation(requestId, conv.patient_id, settings.supervisorProfileId, slot);

  if (result.status === "booked") {
    const { data: patient } = await admin().from("patients").select("full_name").eq("id", conv.patient_id).maybeSingle();
    const { data: room } = await admin().from("rooms").select("name").eq("id", slot.roomId).maybeSingle();
    const { data: supervisor } = await admin().from("profiles").select("full_name").eq("id", settings.supervisorProfileId).maybeSingle();
    const { data: clinicSettings } = await admin().from("clinic_settings").select("address").eq("clinic_id", DEV_CLINIC_ID).maybeSingle();

    await setState(conversationId, "booked");
    await say(
      conversationId,
      waId,
      copy.confirmationText({
        childName: patient?.full_name ?? "",
        dateLabel: slot.dateLabel,
        timeLabel: slot.timeLabel,
        roomName: room?.name ?? "—",
        supervisorName: supervisor?.full_name ?? "coordenação",
        address: clinicSettings?.address ?? null,
      }),
    );
    return;
  }

  if (result.status === "slot_taken") {
    const attempts = Number(conv.context.booking_attempts ?? 0) + 1;
    if (attempts >= MAX_BOOKING_RETRIES) {
      await handleHandoff(conversationId, waId);
      return;
    }
    await patch(conversationId, { context: { ...conv.context, booking_attempts: attempts } });
    await say(conversationId, waId, copy.SLOT_TAKEN_TEXT);
    await offerSlotsNow(conversationId, waId, conv.patient_id, requestId);
    return;
  }

  await say(conversationId, waId, "Tive um problema técnico para agendar. Vou chamar a equipe para te ajudar.");
  await handleHandoff(conversationId, waId);
}

async function handleManageSessionStart(conversationId: string, waId: string) {
  const conv = await getConversation(conversationId);
  if (!conv.patient_id) {
    await say(conversationId, waId, copy.MANAGE_NO_APPOINTMENT_TEXT);
    return;
  }

  const { data: appointments } = await admin()
    .from("appointments")
    .select("id, starts_at, discipline, room_id, therapist_id, rooms(name), profiles!therapist_id(full_name)")
    .eq("patient_id", conv.patient_id)
    .in("status", ["agendada", "confirmada"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);

  if (!appointments || appointments.length === 0) {
    await say(conversationId, waId, copy.MANAGE_NO_APPOINTMENT_TEXT);
    return;
  }

  const rows = appointments.map((a) => {
    const room = Array.isArray(a.rooms) ? a.rooms[0] : a.rooms;
    return {
      id: a.id,
      label: `${a.discipline} — ${new Date(a.starts_at).toLocaleString("pt-BR")} (${room?.name ?? "—"})`,
      roomId: a.room_id,
      therapistId: a.therapist_id,
    };
  });

  await setState(conversationId, "manage_list", { manage_rows: rows });
  await say(conversationId, waId, copy.manageSessionListText(rows));
}

async function handleManageList(conversationId: string, waId: string, conv: ConversationRow, text: string) {
  const rows = (conv.context.manage_rows as { id: string; label: string; roomId: string; therapistId: string }[]) ?? [];
  const index = Number(text.trim()) - 1;
  const row = rows[index];
  if (!row) {
    await say(conversationId, waId, copy.manageSessionListText(rows));
    return;
  }
  await setState(conversationId, "manage_action", { selected_appointment: row });
  await say(conversationId, waId, copy.MANAGE_ACTION_TEXT);
}

async function handleManageAction(conversationId: string, waId: string, conv: ConversationRow, option: string | null) {
  const row = conv.context.selected_appointment as { id: string; roomId: string; therapistId: string } | undefined;
  if (!row) {
    await goToMenu(conversationId, waId);
    return;
  }
  if (option === "1") {
    await confirmAppointment(row.id);
    await setState(conversationId, "menu");
    await say(conversationId, waId, copy.SESSION_CONFIRMED_TEXT);
    return;
  }
  if (option === "2") {
    const slots = await getAvailableSlots(row.roomId, row.therapistId, 50, row.id);
    await setState(conversationId, "manage_reschedule", { reschedule_appointment_id: row.id, reschedule_slots: slots });
    const items = slots.map((s, i) => ({ id: String(i), title: `${s.dateLabel} ${s.timeLabel}` }));
    await getTransport(conversationId).sendListPicker(waId, { body: copy.RESCHEDULE_OFFER_INTRO_TEXT, button: "Ver horários", items });
    return;
  }
  await say(conversationId, waId, copy.MANAGE_ACTION_TEXT);
}

async function handleManageReschedule(conversationId: string, waId: string, conv: ConversationRow, input: NormalizedInbound) {
  const slots = (conv.context.reschedule_slots as { startsAtIso: string; endsAtIso: string }[]) ?? [];
  const appointmentId = String(conv.context.reschedule_appointment_id ?? "");
  const index = Number(input.listId ?? input.text.trim());
  const slot = slots[index];
  if (!slot) {
    await say(conversationId, waId, copy.RESCHEDULE_OFFER_INTRO_TEXT);
    return;
  }
  await rescheduleAppointmentAction(appointmentId, slot.startsAtIso, slot.endsAtIso);
  await setState(conversationId, "menu");
  await say(conversationId, waId, copy.RESCHEDULED_TEXT);
}

export async function handleInbound(conversationId: string, input: NormalizedInbound): Promise<void> {
  const conv = await getConversation(conversationId);

  const { data: clinicSettings } = await admin()
    .from("clinic_settings")
    .select("bot_enabled")
    .eq("clinic_id", conv.clinic_id)
    .maybeSingle();
  if (clinicSettings?.bot_enabled === false) return;

  if (await isRateLimited(conversationId)) {
    await say(conversationId, conv.wa_id, copy.RATE_LIMITED_TEXT);
    return;
  }

  const option = digitOption(input);
  const lowered = input.text.trim().toLowerCase();

  // Handoff humano ativo: bot fica em silêncio, exceto pra "0"/"menu".
  const humanActive = conv.human_requested_at && Date.now() - new Date(conv.human_requested_at).getTime() < HUMAN_SILENCE_MS;
  if (humanActive && option !== "0" && lowered !== "menu") {
    return;
  }

  // Comandos globais.
  if (option === "0" || lowered === "menu") {
    await goToMenu(conversationId, conv.wa_id);
    return;
  }
  if (option === "9" || lowered.includes("humano") || lowered.includes("atendente")) {
    await handleHandoff(conversationId, conv.wa_id);
    return;
  }

  switch (conv.state) {
    case "menu":
      await handleMenuChoice(conversationId, conv.wa_id, option);
      return;

    case "intake_consent":
      await handleConsent(conversationId, conv.wa_id, option);
      return;

    case "intake_guardian_name":
      await setState(conversationId, "intake_guardian_cpf", { guardian_name: input.text.trim() });
      await say(conversationId, conv.wa_id, copy.ASK_GUARDIAN_CPF_TEXT);
      return;

    case "intake_guardian_cpf": {
      if (!isValidCpf(input.text)) {
        const errors = Number(conv.context.cpf_errors ?? 0) + 1;
        if (errors >= 2) {
          await handleHandoff(conversationId, conv.wa_id);
          return;
        }
        await patch(conversationId, { context: { ...conv.context, cpf_errors: errors } });
        await say(conversationId, conv.wa_id, copy.INVALID_CPF_TEXT);
        return;
      }
      await setState(conversationId, "intake_child_name", { guardian_cpf: onlyDigits(input.text), cpf_errors: 0 });
      await say(conversationId, conv.wa_id, copy.ASK_CHILD_NAME_TEXT);
      return;
    }

    case "intake_child_name":
      await setState(conversationId, "intake_child_cpf", { child_name: input.text.trim() });
      await say(conversationId, conv.wa_id, copy.ASK_CHILD_CPF_TEXT);
      return;

    case "intake_child_cpf": {
      if (lowered.includes("não tenho") || lowered.includes("nao tenho")) {
        await setState(conversationId, "intake_child_birth", { child_cpf: null });
        await say(conversationId, conv.wa_id, copy.ASK_CHILD_BIRTH_TEXT);
        return;
      }
      if (!isValidCpf(input.text)) {
        await say(conversationId, conv.wa_id, copy.INVALID_CPF_TEXT);
        return;
      }
      await setState(conversationId, "intake_child_birth", { child_cpf: onlyDigits(input.text) });
      await say(conversationId, conv.wa_id, copy.ASK_CHILD_BIRTH_TEXT);
      return;
    }

    case "intake_child_birth": {
      const birthDate = parseBrazilianBirthDate(input.text);
      if (!birthDate) {
        await say(conversationId, conv.wa_id, copy.INVALID_BIRTH_TEXT);
        return;
      }
      await setState(conversationId, "intake_insurance", { child_birth_date: birthDate });
      const { data: insurers } = await admin().from("insurers").select("name").eq("clinic_id", DEV_CLINIC_ID).order("name");
      await say(conversationId, conv.wa_id, copy.askInsuranceText((insurers ?? []).map((i) => i.name)));
      return;
    }

    case "intake_insurance":
      await handleInsuranceChoice(conversationId, conv.wa_id, input.text);
      return;

    case "intake_card_number": {
      const cardNumber = lowered.includes("não sei") || lowered.includes("nao sei") ? null : input.text.trim();
      await setState(conversationId, "intake_has_docs", { card_number: cardNumber });
      await say(conversationId, conv.wa_id, copy.ASK_HAS_DOCS_TEXT);
      return;
    }

    case "intake_has_docs":
      await handleHasDocsChoice(conversationId, conv.wa_id, option, conv.context);
      return;

    case "intake_missing_docs_offer_human":
      if (option === "1") {
        await handleHandoff(conversationId, conv.wa_id);
      } else {
        await setState(conversationId, "menu");
        await say(conversationId, conv.wa_id, copy.MISSING_DOCS_NO_HUMAN_TEXT);
      }
      return;

    case "intake_wait_laudo":
      await handleDocumentUpload(conversationId, conv.wa_id, conv, input, "laudo");
      return;

    case "intake_wait_guia":
      await handleDocumentUpload(conversationId, conv.wa_id, conv, input, "autorizacao");
      return;

    case "awaiting_supervisor":
      await say(
        conversationId,
        conv.wa_id,
        "Ainda estamos com seus documentos em análise — te aviso assim que a supervisão concluir. 🙏",
      );
      return;

    case "choosing_slot":
      if (conv.context.pending_action === "send_slots") {
        await offerSlotsNow(conversationId, conv.wa_id, conv.patient_id ?? "", String(conv.context.request_id ?? ""));
        return;
      }
      await handleChoosingSlot(conversationId, conv.wa_id, conv, input);
      return;

    case "manage_list":
      await handleManageList(conversationId, conv.wa_id, conv, input.text);
      return;

    case "manage_action":
      await handleManageAction(conversationId, conv.wa_id, conv, option);
      return;

    case "manage_reschedule":
      await handleManageReschedule(conversationId, conv.wa_id, conv, input);
      return;

    case "human_handoff":
      // Silêncio já tratado acima (humanActive); se chegou aqui é porque
      // passou dos 4h — reabre no menu.
      await goToMenu(conversationId, conv.wa_id);
      return;

    case "booked":
      await goToMenu(conversationId, conv.wa_id);
      return;

    default:
      await goToMenu(conversationId, conv.wa_id);
  }
}
