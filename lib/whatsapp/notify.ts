// lib/whatsapp/notify.ts
/**
 * Avisa o responsável depois da decisão do supervisor. Respeita a janela de
 * 24h do WhatsApp (docs.twilio.com/content/session-definitions): dentro da
 * janela manda a lista de horários direto (list-picker, sem aprovação do
 * Meta); fora da janela isso é proibido pra list-picker — manda um template
 * aprovado pedindo pro responsável responder, e só entrega a lista quando
 * ele de fato responder (handleInbound trata `pending_action`).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getTransport } from "./transport";
import { getClinicEvaluationSettings, getEvaluationSlots } from "./slots";
import { getReopenTemplateSid } from "./env";
import * as copy from "./copy";

function isWindowOpen(windowExpiresAt: string | null): boolean {
  if (!windowExpiresAt) return false;
  return new Date(windowExpiresAt).getTime() > Date.now();
}

async function offerSlots(conversationId: string, waId: string, childName: string, guardianName: string) {
  const settings = await getClinicEvaluationSettings();
  const admin = createAdminClient();

  if (!settings) {
    await getTransport(conversationId).sendText(
      waId,
      "Os documentos foram aprovados, mas ainda não temos um horário de avaliação configurado — nossa equipe vai te chamar em breve.",
    );
    return;
  }

  const slots = await getEvaluationSlots(settings);
  const items = [
    ...slots.map((s) => ({ id: s.id, title: `${s.dateLabel} ${s.timeLabel}` })),
    { id: "no_slot_fits", title: copy.NO_SLOT_FITS_OPTION },
  ];

  await admin
    .from("whatsapp_conversations")
    .update({
      state: "choosing_slot",
      context: { offered_slots: slots, offered_at: new Date().toISOString() },
    })
    .eq("id", conversationId);

  await getTransport(conversationId).sendListPicker(waId, {
    body: copy.slotsOfferText(guardianName, childName),
    button: "Ver horários",
    items,
  });
}

export async function notifyGuardianSlots(requestId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("evaluation_requests")
    .select(
      "conversation_id, patient_id, guardian_id, patients(full_name), guardians(full_name), whatsapp_conversations(wa_id, window_expires_at)",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return;
  const conversation = Array.isArray(request.whatsapp_conversations)
    ? request.whatsapp_conversations[0]
    : request.whatsapp_conversations;
  const patient = Array.isArray(request.patients) ? request.patients[0] : request.patients;
  const guardian = Array.isArray(request.guardians) ? request.guardians[0] : request.guardians;
  if (!conversation) return;

  const childName = patient?.full_name ?? "seu filho(a)";
  const guardianName = guardian?.full_name ?? "";

  if (isWindowOpen(conversation.window_expires_at)) {
    await offerSlots(request.conversation_id, conversation.wa_id, childName, guardianName);
    return;
  }

  const templateSid = getReopenTemplateSid();
  await admin
    .from("whatsapp_conversations")
    .update({ context: { pending_action: "send_slots" } })
    .eq("id", request.conversation_id);

  if (templateSid) {
    await getTransport(request.conversation_id).sendTemplate(conversation.wa_id, templateSid, {
      "1": guardianName,
      "2": childName,
    });
  } else {
    // Sem template configurado (ainda não temos sender aprovado pelo Meta) —
    // registra a intenção mesmo assim; no simulador isso é visível no
    // transcript, e em produção real precisa de TWILIO_TEMPLATE_REOPEN_SID.
    await getTransport(request.conversation_id).sendText(conversation.wa_id, copy.REOPEN_TEMPLATE_FALLBACK_BODY);
  }
}

export async function notifyRejection(requestId: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("evaluation_requests")
    .select("conversation_id, guardians(full_name), whatsapp_conversations(wa_id)")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return;
  const conversation = Array.isArray(request.whatsapp_conversations)
    ? request.whatsapp_conversations[0]
    : request.whatsapp_conversations;
  const guardian = Array.isArray(request.guardians) ? request.guardians[0] : request.guardians;
  if (!conversation) return;

  await admin.from("whatsapp_conversations").update({ state: "intake_wait_laudo" }).eq("id", request.conversation_id);
  await getTransport(request.conversation_id).sendText(
    conversation.wa_id,
    copy.rejectionText(guardian?.full_name ?? "", reason),
  );
}
