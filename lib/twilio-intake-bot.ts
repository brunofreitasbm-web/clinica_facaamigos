// lib/twilio-intake-bot.ts
// Máquina de estados do bot de WhatsApp do "acolhimento oriundo de plano de
// saúde": depois que o supervisor aprova um lead extraído do PDF do
// convênio (app/supervisao/acolhimento-actions.ts), este bot conversa com o
// responsável pra coletar Laudo + Guia/Autorização, espera a validação do
// supervisor e, uma vez aprovada, oferece os horários vagos da avaliação —
// o responsável escolhe pelo número, e o agendamento é feito de forma
// atômica via a RPC `book_intake_lead_slot_atomic`. Mesmo desenho de
// lib/twilio-anamnesis-bot.ts (chatbot_sessions por telefone), mas com
// `flow`/`lead_id` (migration 20260907170006) pra não colidir com os outros
// bots que também usam chatbot_sessions.
import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp, findOrCreateConversation } from "@/lib/twilio";
import { downloadTwilioMedia, ALLOWED_MIME_TYPES, sanitizeFileName, extensionFor, MAX_FILE_BYTES } from "@/lib/registration-drafts-ingest";
import { CLINIC_TIMEZONE } from "@/lib/constants";

const DOCUMENTS_BUCKET = "clinic-documents";
const MIN_FILES_TO_AUTO_ADVANCE = 2;

type IntakeStep = "intake_awaiting_documents" | "intake_pending_supervisor" | "intake_awaiting_slot" | "intake_completed";

// `aba_class_id` presente = a opção oferecida é um bloco de 2h de Treino
// ABA numa turma (sala e horário vêm da turma), não uma sessão de avaliação
// de 50min. A reserva então passa por `book_aba_training_slot_atomic` em vez
// de `book_intake_lead_slot_atomic` — ver
// supabase/migrations/20260910040000_aba_training_billing_and_intake.sql.
type OfferedSlot = {
  index: number;
  label: string;
  starts_at: string;
  ends_at: string;
  therapist_id: string;
  room_id: string;
  aba_class_id?: string | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

async function getLeadFileCount(admin: AdminClient, leadId: string): Promise<number> {
  const { count } = await admin.from("insurance_intake_lead_files").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
  return count ?? 0;
}

/**
 * Loga uma mensagem do bot em `messages`/`twilio_conversations` — mesmo
 * padrão do webhook (app/api/webhooks/twilio/route.ts), mas chamado tanto
 * pelas respostas em tempo real deste bot (log feito pelo próprio webhook,
 * então NÃO é usado por processIntakeBotStep) quanto pelos envios
 * "fora de banda" disparados pelas Server Actions do supervisor (aprovar
 * contato, aprovar/rejeitar documentos) — esses precisam logar por conta
 * própria porque não passam pelo webhook de entrada.
 */
async function sendIntakeMessage(
  admin: AdminClient,
  params: { patientId: string; guardianId?: string | null; conversationId?: string | null; phoneE164: string; text: string },
): Promise<{ success: boolean; error?: string }> {
  // Só a 1ª mensagem (startIntakeConversation) precisa do template Meta —
  // a partir da primeira resposta do responsável, a janela de 24h de
  // serviço está aberta e mensagem livre é entregue normalmente.
  const send = await sendTwilioWhatsApp({ to: params.phoneE164, message: params.text });

  let conversationId = params.conversationId ?? null;
  if (!conversationId) {
    try {
      const conversation = await findOrCreateConversation({
        phoneNumber: params.phoneE164,
        patientId: params.patientId,
        guardianId: params.guardianId ?? undefined,
      });
      conversationId = conversation.id;
    } catch (err) {
      console.error("[Intake Bot] Falha ao localizar conversa:", err);
    }
  }

  if (conversationId) {
    await admin.from("messages").insert({
      patient_id: params.patientId,
      guardian_id: params.guardianId ?? null,
      conversation_id: conversationId,
      sender_type: "bot",
      channel: "whatsapp",
      direction: "outbound",
      body: params.text,
      sent_at: new Date().toISOString(),
      twilio_sid: send.messageId ?? null,
      delivery_status: send.success ? "sent" : "failed",
    });
    await admin.from("twilio_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  }

  return send.success ? { success: true } : { success: false, error: send.error };
}

/**
 * Inicia a conversa do bot com o responsável de um lead recém-aprovado.
 * Chamado por approveIntakeLeadsAndStartContact
 * (app/supervisao/acolhimento-actions.ts) depois de criar
 * paciente/responsável/conversa. Recusa iniciar se o telefone já estiver
 * numa sessão de bot ATIVA de outro fluxo (evita que duas conversas
 * concorrentes escrevam na mesma linha de chatbot_sessions) — nesse caso
 * quem chamou decide o que fazer (o lead fica 'failed' com o motivo).
 */
export async function startIntakeConversation(leadId: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("insurance_intake_leads")
    .select("id, patient_id, guardian_id, conversation_id, phone_e164, patient_full_name, insurer_id, insurers(name)")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead || !lead.patient_id || !lead.phone_e164) {
    return { success: false, error: "Lead sem paciente ou telefone válido." };
  }

  const { data: existingSession } = await admin.from("chatbot_sessions").select("current_step, flow").eq("phone_number", lead.phone_e164).maybeSingle();

  const stepIsFree = !existingSession || existingSession.current_step === "idle" || existingSession.current_step === "completed" || (existingSession.flow === "intake" && (existingSession.current_step ?? "").startsWith("intake_"));
  if (!stepIsFree) {
    return { success: false, error: "Este telefone já está em outro atendimento automático — tente novamente mais tarde." };
  }

  const insurerRef = Array.isArray(lead.insurers) ? lead.insurers[0] : lead.insurers;
  const insurerName = insurerRef?.name ?? "seu plano de saúde";
  const childName = lead.patient_full_name ?? "seu(sua) filho(a)";

  const text =
    `Olá! 💙 Seja muito bem-vindo(a) ao *FaçaAmigos - Centro de Terapia Comportamental*!\n\n` +
    `Recebemos do *${insurerName}* o encaminhamento de *${childName}* para a avaliação. É uma alegria podermos caminhar juntos no desenvolvimento da sua criança ou adolescente! 🧩✨\n\n` +
    `Para agendarmos a avaliação, precisamos de dois documentos (pode enviar foto ou PDF por aqui):\n\n` +
    `1️⃣ *Laudo Médico*\n2️⃣ *Guia / Autorização do Plano*\n\n` +
    `Quando terminar de enviar, responda *PRONTO*. Se precisar encerrar a conversa por aqui, responda *PARAR*.`;

  const templateSid = process.env.TWILIO_INTAKE_TEMPLATE_CONTENT_SID;
  const send = await sendTwilioWhatsApp({
    to: lead.phone_e164,
    message: text,
    ...(templateSid ? { contentSid: templateSid, contentVariables: { "1": insurerName, "2": childName } } : {}),
  });

  if (!send.success) {
    return { success: false, error: send.error ?? "Falha ao enviar mensagem via WhatsApp." };
  }

  let conversationId = lead.conversation_id;
  if (!conversationId) {
    try {
      const conversation = await findOrCreateConversation({ phoneNumber: lead.phone_e164, patientId: lead.patient_id, guardianId: lead.guardian_id ?? undefined });
      conversationId = conversation.id;
      await admin.from("insurance_intake_leads").update({ conversation_id: conversationId }).eq("id", leadId);
    } catch (err) {
      console.error("[Intake Bot] Falha ao criar conversa:", err);
    }
  }

  if (conversationId) {
    await admin.from("messages").insert({
      patient_id: lead.patient_id,
      guardian_id: lead.guardian_id ?? null,
      conversation_id: conversationId,
      sender_type: "bot",
      channel: "whatsapp",
      direction: "outbound",
      body: text,
      sent_at: new Date().toISOString(),
      twilio_sid: send.messageId ?? null,
      delivery_status: "sent",
    });
  }

  await admin.from("chatbot_sessions").upsert(
    {
      phone_number: lead.phone_e164,
      flow: "intake",
      lead_id: leadId,
      current_step: "intake_awaiting_documents",
      collected_data: { child_name: childName, insurer_name: insurerName },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" },
  );

  return { success: true };
}

/**
 * Envia (fora do fluxo de resposta a mensagem inbound) uma atualização de
 * status para o responsável de um lead — aprovação/rejeição de documentos,
 * lista de horários. Usado pelas Server Actions do supervisor.
 */
export async function pushIntakeUpdate(leadId: string, text: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("insurance_intake_leads")
    .select("patient_id, guardian_id, conversation_id, phone_e164")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead || !lead.patient_id || !lead.phone_e164) return { success: false, error: "Lead sem paciente ou telefone." };

  return sendIntakeMessage(admin, {
    patientId: lead.patient_id,
    guardianId: lead.guardian_id,
    conversationId: lead.conversation_id,
    phoneE164: lead.phone_e164,
    text,
  });
}

/** Grava os horários oferecidos na sessão do bot e avança pro step de escolha. */
export async function setIntakeAwaitingSlot(leadId: string, phoneE164: string, slots: OfferedSlot[]): Promise<void> {
  const admin = createAdminClient();
  const { data: session } = await admin.from("chatbot_sessions").select("collected_data").eq("phone_number", phoneE164).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collected = (session?.collected_data as Record<string, any>) ?? {};
  collected.available_slots = slots;

  await admin.from("chatbot_sessions").upsert(
    { phone_number: phoneE164, flow: "intake", lead_id: leadId, current_step: "intake_awaiting_slot", collected_data: collected, updated_at: new Date().toISOString() },
    { onConflict: "phone_number" },
  );
}

export type IntakeBotResult = { handled: boolean; replyMessage: string };

/**
 * Processa uma mensagem inbound do WhatsApp contra a máquina de estados do
 * bot de acolhimento. Só "pega" a mensagem se a sessão do telefone já
 * estiver num step `intake_*` — chamado ANTES da ingestão genérica de
 * "cadastro assistido por IA" em lib/twilio.ts (passo 0.6).
 */
export async function processIntakeBotStep(params: { from: string; body: string; media?: { url: string; contentType?: string }[] }): Promise<IntakeBotResult> {
  const phone = formatE164Phone(params.from.replace("whatsapp:", ""));
  const rawBody = (params.body || "").trim();
  const upperBody = rawBody.toUpperCase();
  const media = params.media ?? [];

  const admin = createAdminClient();
  const { data: session } = await admin.from("chatbot_sessions").select("*").eq("phone_number", phone).maybeSingle();

  if (!session || session.flow !== "intake" || !(session.current_step ?? "").startsWith("intake_")) {
    return { handled: false, replyMessage: "" };
  }

  const leadId: string | null = session.lead_id;
  const step = session.current_step as IntakeStep;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (session.collected_data as Record<string, any>) ?? {};

  if (!leadId) {
    return { handled: false, replyMessage: "" };
  }

  if (upperBody === "PARAR" || upperBody === "SAIR") {
    await admin.from("chatbot_sessions").update({ current_step: "idle", updated_at: new Date().toISOString() }).eq("phone_number", phone);
    await admin.from("insurance_intake_leads").update({ status: "cancelled", status_reason: "opt_out", cancelled_at: new Date().toISOString() }).eq("id", leadId);
    return { handled: true, replyMessage: "Tudo bem, encerramos por aqui. Se precisar, é só chamar a clínica diretamente. 🙏" };
  }

  if (upperBody === "AJUDA") {
    return {
      handled: true,
      replyMessage: "Você pode mandar foto ou PDF do Laudo e da Guia/autorização por aqui. Quando terminar, responda *PRONTO*. Para encerrar, responda *PARAR*.",
    };
  }

  // --- intake_awaiting_documents ------------------------------------------
  if (step === "intake_awaiting_documents") {
    let savedCount = 0;
    let sawUnsupported = false;
    let sawDownloadFailure = false;

    for (const item of media) {
      const downloaded = await downloadTwilioMedia(item.url, item.contentType);
      if (!downloaded) {
        sawDownloadFailure = true;
        continue;
      }
      if (!ALLOWED_MIME_TYPES.has(downloaded.mime) || downloaded.buffer.byteLength > MAX_FILE_BYTES) {
        sawUnsupported = true;
        continue;
      }

      const existingCount = await getLeadFileCount(admin, leadId);
      const fileName = `${existingCount + savedCount}-${Date.now()}.${extensionFor(downloaded.mime)}`;
      const storagePath = `intake/leads/${leadId}/${fileName}`;

      const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, downloaded.buffer, {
        contentType: downloaded.mime,
        upsert: false,
      });
      if (uploadError) {
        sawDownloadFailure = true;
        continue;
      }

      const { error: insertError } = await admin.from("insurance_intake_lead_files").insert({
        lead_id: leadId,
        storage_path: storagePath,
        mime_type: downloaded.mime,
        size_bytes: downloaded.buffer.byteLength,
        original_name: sanitizeFileName(fileName),
        twilio_media_url: item.url,
      });
      // Índice único em twilio_media_url: reentrega do webhook não duplica
      // o arquivo — erro de violação de unicidade é esperado e ignorado.
      if (!insertError) savedCount++;
    }

    if (savedCount > 0) {
      await admin.from("insurance_intake_leads").update({ last_file_at: new Date().toISOString() }).eq("id", leadId);
    }

    const totalFiles = await getLeadFileCount(admin, leadId);
    const readyToAdvance = upperBody === "PRONTO" || totalFiles >= MIN_FILES_TO_AUTO_ADVANCE;

    if (readyToAdvance && totalFiles > 0) {
      await admin.from("chatbot_sessions").update({ current_step: "intake_pending_supervisor", updated_at: new Date().toISOString() }).eq("phone_number", phone);
      await admin.from("insurance_intake_leads").update({ status: "pending_supervisor" }).eq("id", leadId);
      return {
        handled: true,
        replyMessage: "Tudo certo! 🎉 Recebemos os documentos. Nossa equipe vai conferir e avisamos por aqui assim que estiver aprovado, com os horários disponíveis para a avaliação.",
      };
    }

    if (upperBody === "PRONTO" && totalFiles === 0) {
      return { handled: true, replyMessage: "Ainda não recebemos nenhum arquivo. Pode mandar o Laudo e a Guia/autorização por foto ou PDF, direto por aqui?" };
    }

    if (savedCount > 0) {
      return {
        handled: true,
        replyMessage: `Recebido! Já são *${totalFiles} arquivo(s)*. Pode mandar os outros ou, se já enviou tudo, responda *PRONTO*.`,
      };
    }

    if (sawUnsupported) {
      return { handled: true, replyMessage: "Só conseguimos ler fotos (JPG/PNG) e PDF, até 25MB. Pode reenviar nesse formato?" };
    }
    if (sawDownloadFailure) {
      return { handled: true, replyMessage: "Não conseguimos salvar o arquivo agora. Pode tentar enviar de novo em alguns instantes?" };
    }

    return {
      handled: true,
      replyMessage: "Aguardando os documentos: *Laudo* e *Guia/autorização* do plano. Pode mandar foto ou PDF por aqui, ou responda *AJUDA*.",
    };
  }

  // --- intake_pending_supervisor -------------------------------------------
  if (step === "intake_pending_supervisor") {
    // Documentos extras ainda são aceitos e anexados ao lead, mesmo já em análise.
    for (const item of media) {
      const downloaded = await downloadTwilioMedia(item.url, item.contentType);
      if (!downloaded || !ALLOWED_MIME_TYPES.has(downloaded.mime) || downloaded.buffer.byteLength > MAX_FILE_BYTES) continue;
      const existingCount = await getLeadFileCount(admin, leadId);
      const fileName = `${existingCount}-${Date.now()}.${extensionFor(downloaded.mime)}`;
      const storagePath = `intake/leads/${leadId}/${fileName}`;
      const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, downloaded.buffer, { contentType: downloaded.mime, upsert: false });
      if (!uploadError) {
        await admin.from("insurance_intake_lead_files").insert({
          lead_id: leadId,
          storage_path: storagePath,
          mime_type: downloaded.mime,
          size_bytes: downloaded.buffer.byteLength,
          original_name: sanitizeFileName(fileName),
          twilio_media_url: item.url,
        });
        await admin.from("insurance_intake_leads").update({ last_file_at: new Date().toISOString() }).eq("id", leadId);
      }
    }

    return {
      handled: true,
      replyMessage: "Seus documentos já estão com a nossa equipe para conferência. Assim que forem aprovados, mandamos os horários disponíveis por aqui!",
    };
  }

  // --- intake_awaiting_slot -------------------------------------------------
  if (step === "intake_awaiting_slot") {
    const slots = (data.available_slots as OfferedSlot[] | undefined) ?? [];
    const choiceNum = parseInt(rawBody, 10);
    const selected = slots.find((s) => s.index === choiceNum);

    if (!choiceNum || !selected) {
      return { handled: true, replyMessage: "Opção inválida. Responda apenas com o *número* do horário desejado (ex.: 1, 2, 3...)." };
    }

    const { data: rpcResult, error: rpcErr } = selected.aba_class_id
      ? await admin.rpc("book_aba_training_slot_atomic", {
          p_lead_id: leadId,
          p_class_id: selected.aba_class_id,
          p_therapist_id: selected.therapist_id,
          p_starts_at: selected.starts_at,
        })
      : await admin.rpc("book_intake_lead_slot_atomic", {
          p_lead_id: leadId,
          p_therapist_id: selected.therapist_id,
          p_room_id: selected.room_id,
          p_starts_at: selected.starts_at,
          p_ends_at: selected.ends_at,
        });

    const resObj = rpcResult as { success?: boolean; error?: string } | null;
    if (rpcErr || !resObj?.success) {
      const reason = resObj?.error || rpcErr?.message || "Erro ao efetuar a reserva.";
      return { handled: true, replyMessage: `⚠️ ${reason}\n\nResponda com outro número de horário vago.` };
    }

    await admin.from("chatbot_sessions").update({ current_step: "idle", collected_data: {}, updated_at: new Date().toISOString() }).eq("phone_number", phone);

    const formattedDate = new Date(selected.starts_at).toLocaleString("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      dateStyle: "full",
      timeStyle: "short",
    });

    return {
      handled: true,
      replyMessage:
        `⏳ *Horário em aprovação!*\n\n` +
        `👤 *Paciente:* ${data.child_name ?? "—"}\n` +
        `📅 *Data e horário escolhido:* ${formattedDate}` +
        (selected.aba_class_id ? `\n⏱️ *Duração:* bloco de 2h (3 sessões de 40min)` : "") +
        `\n\n` +
        "Nossa supervisão irá analisar os documentos e a data escolhida. Em breve você receberá a confirmação final por aqui junto com o link para o formulário de anamnese!",
    };
  }

  return { handled: false, replyMessage: "" };
}
