"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { sendTwilioWhatsApp } from "@/lib/twilio";
import { createInteressadoAction, type CreateInteressadoInput } from "../actions";
import { generateGeminiChatResponse, isGeminiConfigured } from "@/lib/gemini";
import { formatConversationPhone } from "./format-phone";
import { ATTENDANCE_MANUAL_OUTCOMES, type AttendanceManualOutcome } from "@/lib/conversation-attendance";

export type ExtractedLeadInfo = {
  fullName: string;
  birthDate: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship: string;
  origin: string;
  chiefComplaint: string;
};

export async function sendManualMessage(conversationId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { success: false as const, error: "Mensagem vazia." };

  const supabase = await createClient();

  const { data: conversation, error: convError } = await supabase
    .from("twilio_conversations")
    .select("id, phone_number, patient_id, guardian_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError || !conversation) {
    return { success: false as const, error: "Conversa não encontrada." };
  }

  const sendResult = await sendTwilioWhatsApp({ to: conversation.phone_number, message: trimmed });

  // Detecta se a falha é por conta/perfil KYC pendente na Twilio ou por bloqueio de janela 24h da Meta (Erro 63016)
  const isKycOrAccountPending =
    !sendResult.success &&
    Boolean(
      sendResult.error &&
        (sendResult.error.includes("20003") ||
          sendResult.error.includes("compliance profile") ||
          sendResult.error.includes("Trust Hub") ||
          sendResult.error.includes("não está configurado")),
    );

  const deliveryStatus = sendResult.success
    ? "sent"
    : isKycOrAccountPending
      ? "simulated_dev"
      : "failed";

  const { error: insertError } = await supabase.from("messages").insert({
    patient_id: conversation.patient_id,
    guardian_id: conversation.guardian_id,
    conversation_id: conversation.id,
    sender_type: "agent",
    channel: "whatsapp",
    direction: "outbound",
    body: trimmed,
    sent_at: new Date().toISOString(),
    twilio_sid: sendResult.messageId ?? null,
    delivery_status: deliveryStatus,
  });

  if (insertError) {
    return { success: false as const, error: insertError.message };
  }

  if (isKycOrAccountPending) {
    await supabase
      .from("twilio_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "open", escalation_reason: null })
      .eq("id", conversationId);

    revalidatePath("/recepcao/atendimento");
    return {
      success: true as const,
      warning:
        "Mensagem registrada no histórico local (O envio externo requer a validação de perfil KYC no Console da Twilio).",
    };
  }

  if (!sendResult.success) {
    return {
      success: false as const,
      error: sendResult.error || "Falha ao enviar mensagem pelo Twilio WhatsApp.",
    };
  }

  // Um humano respondeu: a conversa sai da fila de escalação do bot
  await supabase
    .from("twilio_conversations")
    .update({ last_message_at: new Date().toISOString(), status: "open", escalation_reason: null })
    .eq("id", conversationId);

  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function toggleBotActive(conversationId: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update(
      value
        ? { is_bot_active: true, status: "open", escalation_reason: null }
        : { is_bot_active: false },
    )
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

/**
 * "Assumir" a conversa: registra quem da equipe está cuidando dela (coluna
 * `assigned_to`, que existe desde a migration 20260906000010 mas nunca foi
 * usada) e tira o bot da frente, para ninguém responder em duplicidade.
 */
export async function assignConversation(conversationId: string, assign: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Sessão expirada." };

  const { error } = await supabase
    .from("twilio_conversations")
    .update(assign ? { assigned_to: user.id, is_bot_active: false } : { assigned_to: null })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const, assignedTo: assign ? user.id : null };
}

/**
 * Encerrar devolve a conversa ao bot e libera o responsável; se o contato
 * escrever de novo, o webhook (lib/twilio.ts) reabre sozinho.
 */
export async function setConversationClosed(
  conversationId: string,
  closed: boolean,
  outcome?: AttendanceManualOutcome,
  note?: string,
) {
  if (closed && (!outcome || !ATTENDANCE_MANUAL_OUTCOMES.includes(outcome))) {
    return { success: false as const, error: "Informe como o atendimento terminou." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("twilio_conversations")
    .update(
      closed
        ? { status: "closed", unread_count: 0, assigned_to: null, is_bot_active: true, escalation_reason: null }
        : { status: "open" },
    )
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };

  // Fecha o atendimento aberto (métrica de fechamento). Se o trigger de
  // agendamento já o fechou como 'agendado', não sobra linha aberta e o
  // update não faz nada.
  if (closed && outcome) {
    const { error: attendanceError } = await supabase
      .from("conversation_attendances")
      .update({
        closed_at: new Date().toISOString(),
        outcome,
        outcome_note: note?.trim() || null,
        closed_by: user?.id ?? null,
        closed_by_kind: "agent",
      })
      .eq("conversation_id", conversationId)
      .is("closed_at", null);
    if (attendanceError) {
      return {
        success: false as const,
        error: `Conversa encerrada, mas o desfecho não foi registrado: ${attendanceError.message}`,
      };
    }
  }

  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function updateConversationContactName(conversationId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update({ contact_name: name.trim() || null })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function saveConversationNote(conversationId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update({ internal_note: note.trim() || null, internal_note_updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

/**
 * Transfere todos os arquivos (PDFs e imagens) enviados pelo responsável na conversa,
 * rascunhos de cadastro e acolhimentos para a tabela `documents` (Prontuário do Paciente).
 */
export async function transferConversationMediaToPatientDocuments(
  conversationId: string,
  patientId: string,
  actorId?: string | null,
) {
  try {
    const admin = createAdminClient();

    // 1. Telefone da conversa
    const { data: conversation } = await admin
      .from("twilio_conversations")
      .select("phone_number")
      .eq("id", conversationId)
      .maybeSingle();

    const rawPhone = conversation?.phone_number || "";
    const { downloadTwilioMedia, extensionFor } = await import("@/lib/registration-drafts-ingest");

    // 2. Transfere mídias das mensagens da conversa
    const { data: messages } = await admin
      .from("messages")
      .select("id, body, media_url, sent_at")
      .eq("conversation_id", conversationId)
      .not("media_url", "is", null);

    for (const msg of messages ?? []) {
      if (!msg.media_url) continue;
      const mediaUrls = msg.media_url.split(/[\s,]+/).filter(Boolean);

      for (const url of mediaUrls) {
        try {
          if (url.startsWith("http://") || url.startsWith("https://")) {
            const downloaded = await downloadTwilioMedia(url);
            if (downloaded) {
              const docId = randomUUID();
              const ext = extensionFor(downloaded.mime);
              const fileName = `whatsapp_${msg.id}_${Date.now()}.${ext}`;
              const storagePath = `${patientId}/${docId}/${fileName}`;

              const { error: uploadErr } = await admin.storage
                .from("clinic-documents")
                .upload(storagePath, downloaded.buffer, {
                  contentType: downloaded.mime,
                  upsert: false,
                });

              if (!uploadErr) {
                const bodyLower = (msg.body || "").toLowerCase();
                let category = "outro";
                if (bodyLower.includes("laudo") || bodyLower.includes("diagnostico") || bodyLower.includes("relatorio")) category = "laudo";
                else if (bodyLower.includes("pedido") || bodyLower.includes("encaminhamento") || bodyLower.includes("medico")) category = "pedido_medico";
                else if (bodyLower.includes("carteirinha") || bodyLower.includes("cartao") || bodyLower.includes("plano")) category = "carteirinha";
                else if (bodyLower.includes("termo") || bodyLower.includes("lgpd")) category = "termo";
                else if (downloaded.mime === "application/pdf") category = "laudo";

                await admin.from("documents").insert({
                  id: docId,
                  patient_id: patientId,
                  category,
                  storage_path: storagePath,
                  uploaded_by: actorId || DEV_CLINIC_ID,
                  uploaded_at: msg.sent_at || new Date().toISOString(),
                  shared_with_family: false,
                  note: "Anexo enviado pelo responsável no WhatsApp",
                });
              }
            }
          }
        } catch (mediaErr) {
          console.error("Erro ao transferir mídia da mensagem:", mediaErr);
        }
      }
    }

    // 3. Rascunhos de cadastro (registration_draft_files)
    if (rawPhone) {
      const cleanPhone = rawPhone.replace("whatsapp:", "").replace(/\D/g, "");
      const last8 = cleanPhone.slice(-8);

      if (last8.length >= 8) {
        const { data: drafts } = await admin
          .from("registration_drafts")
          .select("id")
          .or(`source_phone.ilike.%${last8}%,patient_id.eq.${patientId}`);

        const draftIds = (drafts ?? []).map((d) => d.id);
        if (draftIds.length > 0) {
          const { data: draftFiles } = await admin
            .from("registration_draft_files")
            .select("id, storage_path, mime_type, detected_type, document_id")
            .in("draft_id", draftIds);

          for (const file of draftFiles ?? []) {
            if (file.document_id) continue;

            const docId = randomUUID();
            const baseName = file.storage_path.split("/").pop() ?? `draft_${Date.now()}`;
            const destPath = `${patientId}/${docId}/${baseName}`;

            const { error: copyErr } = await admin.storage
              .from("clinic-documents")
              .copy(file.storage_path, destPath);

            if (!copyErr) {
              const category = file.detected_type || (file.mime_type === "application/pdf" ? "laudo" : "outro");
              const { error: insertErr } = await admin.from("documents").insert({
                id: docId,
                patient_id: patientId,
                category,
                storage_path: destPath,
                uploaded_by: actorId || DEV_CLINIC_ID,
                shared_with_family: false,
                note: "Enviado no rascunho de cadastro assistido por IA",
              });

              if (!insertErr) {
                await admin
                  .from("registration_draft_files")
                  .update({ document_id: docId })
                  .eq("id", file.id);
              }
            }
          }

          await admin
            .from("registration_drafts")
            .update({ status: "validated", patient_id: patientId })
            .in("id", draftIds);
        }
      }
    }

    // 4. Arquivos do Acolhimento de Plano de Saúde (insurance_intake_lead_files)
    if (rawPhone) {
      const cleanPhone = rawPhone.replace("whatsapp:", "").replace(/\D/g, "");
      const last8 = cleanPhone.slice(-8);

      if (last8.length >= 8) {
        const { data: intakeLeads } = await admin
          .from("insurance_intake_leads")
          .select("id")
          .or(`phone_e164.ilike.%${last8}%,patient_id.eq.${patientId}`);

        const leadIds = (intakeLeads ?? []).map((l) => l.id);
        if (leadIds.length > 0) {
          const { data: intakeFiles } = await admin
            .from("insurance_intake_lead_files")
            .select("id, storage_path, file_type, document_id")
            .in("lead_id", leadIds);

          for (const file of intakeFiles ?? []) {
            if (file.document_id) continue;

            const docId = randomUUID();
            const baseName = file.storage_path.split("/").pop() ?? `intake_${Date.now()}`;
            const destPath = `${patientId}/${docId}/${baseName}`;

            const { error: copyErr } = await admin.storage
              .from("clinic-documents")
              .copy(file.storage_path, destPath);

            if (!copyErr) {
              const category = file.file_type || "laudo";
              const { error: insertErr } = await admin.from("documents").insert({
                id: docId,
                patient_id: patientId,
                category,
                storage_path: destPath,
                uploaded_by: actorId || DEV_CLINIC_ID,
                shared_with_family: false,
                note: "Enviado no acolhimento de plano de saúde",
              });

              if (!insertErr) {
                await admin
                  .from("insurance_intake_lead_files")
                  .update({ document_id: docId })
                  .eq("id", file.id);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Exceção ao transferir mídias da conversa para o prontuário do paciente:", err);
  }
}

/**
 * Cadastro rápido de interessado a partir de uma conversa de lead. Diferente
 * de cadastrar pela home da recepção, aqui a conversa é vinculada na hora —
 * o webhook só promoveria o lead na PRÓXIMA mensagem que o contato mandasse.
 * As mensagens já trocadas também ganham o patient_id, para aparecerem no
 * histórico do paciente, e todos os PDFs/imagens enviados são copiados para o prontuário.
 */
export async function registerLeadAsInteressado(conversationId: string, input: CreateInteressadoInput) {
  const result = await createInteressadoAction(input);
  if (!result.success || !result.patientId) {
    return { success: false as const, error: result.error ?? "Falha ao cadastrar interessado." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, full_name")
    .eq("patient_id", result.patientId)
    .limit(1)
    .maybeSingle();

  const { error: linkError } = await supabase
    .from("twilio_conversations")
    .update({
      patient_id: result.patientId,
      guardian_id: guardian?.id ?? null,
      kind: "patient",
      contact_name: input.guardianName.trim() || null,
    })
    .eq("id", conversationId);

  if (linkError) {
    return {
      success: false as const,
      error: `Paciente cadastrado, mas a conversa não foi vinculada: ${linkError.message}`,
    };
  }

  await supabase
    .from("messages")
    .update({ patient_id: result.patientId, guardian_id: guardian?.id ?? null })
    .eq("conversation_id", conversationId)
    .is("patient_id", null);

  // Transfere todos os arquivos da conversa (PDFs/imagens) para a tabela `documents` (Prontuário do Paciente)
  await transferConversationMediaToPatientDocuments(conversationId, result.patientId, user?.id ?? null);

  revalidatePath("/recepcao/atendimento");
  revalidatePath(`/recepcao/pacientes/${result.patientId}`);
  return {
    success: true as const,
    patientId: result.patientId,
    guardianId: guardian?.id ?? null,
    patientName: input.fullName.trim(),
    guardianName: guardian?.full_name ?? null,
    warning: result.error ?? null,
  };
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("twilio_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);

  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function createQuickResponse(clinicId: string, shortcut: string, title: string, contentText: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("quick_responses").insert({
    clinic_id: clinicId,
    shortcut: shortcut.startsWith("/") ? shortcut : `/${shortcut}`,
    title,
    content_text: contentText,
    created_by: user?.id ?? null,
  });

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function updateQuickResponse(id: string, title: string, contentText: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quick_responses")
    .update({ title, content_text: contentText })
    .eq("id", id);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function deleteQuickResponse(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quick_responses").delete().eq("id", id);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/recepcao/atendimento");
  return { success: true as const };
}

export async function extractLeadInfoFromChat(conversationId: string) {
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("twilio_conversations")
    .select("id, phone_number, contact_name")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    return { success: false as const, error: "Conversa não encontrada." };
  }

  const phoneFormatted = formatConversationPhone(conversation.phone_number);

  const fallbackData: ExtractedLeadInfo = {
    fullName: "",
    birthDate: "",
    guardianName: conversation.contact_name || "",
    guardianPhone: phoneFormatted,
    guardianRelationship: "Mãe",
    origin: "WhatsApp",
    chiefComplaint: "",
  };

  const { data: messages } = await supabase
    .from("messages")
    .select("sender_type, direction, body, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(50);

  if (!messages || messages.length === 0 || !isGeminiConfigured()) {
    return { success: true as const, data: fallbackData };
  }

  const transcript = messages
    .filter((m) => m.body && m.body.trim().length > 0)
    .map((m) => `[${m.direction === "inbound" ? "Contato/Responsável" : "Atendente/Bot"}]: ${m.body}`)
    .join("\n");

  if (!transcript) {
    return { success: true as const, data: fallbackData };
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const systemInstruction = `Você é um assistente de IA especialista da recepção de uma clínica de desenvolvimento infantil (terapias de neurodesenvolvimento, ABA, psicologia, fonoaudiologia, terapia ocupacional).
Analise o histórico de mensagens trocadas via WhatsApp e extraia com precisão os dados para o cadastro do paciente interessado.

Retorne um JSON estrito no seguinte formato:
{
  "fullName": "<Nome completo ou primeiro nome da criança/paciente se encontrado no chat, senão null>",
  "birthDate": "<Data de nascimento da criança no formato YYYY-MM-DD se informada, ou calculada se dada a idade (ex: se o chat fala que a criança tem 3 anos e a data atual é ${currentDate}, calcule o ano de nascimento aproximado como YYYY-01-01), senão null>",
  "guardianName": "<Nome completo ou primeiro nome do responsável (mãe, pai, etc.) se informado, senão null>",
  "guardianPhone": "<Telefone/WhatsApp do responsável, ou null>",
  "guardianRelationship": "<Um destes exatamente: 'Mãe', 'Pai', 'Avó/Avô', 'Tio(a)', 'Responsável'>",
  "origin": "<Um destes exatamente: 'WhatsApp', 'Instagram', 'Google', 'Indicação', 'Plano de Saúde', 'Outro'>",
  "chiefComplaint": "<Resumo de 1 a 2 frases da queixa principal ou motivo de procura da família (ex: suspeita de TEA, atraso na fala, indicação médica, agendamento de avaliação), senão null>"
}`;

  const prompt = `Contato WhatsApp Registrado: ${conversation.contact_name || "Desconhecido"}
Telefone: ${conversation.phone_number}

Histórico da Conversa:
${transcript}`;

  try {
    const aiRes = await generateGeminiChatResponse({
      prompt,
      systemInstruction,
      temperature: 0.1,
      jsonMode: true,
      feature: "pre_cadastro_conversa",
    });

    if (aiRes.success && aiRes.text) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(aiRes.text);
      } catch {
        const jsonMatch = aiRes.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      const extracted: ExtractedLeadInfo = {
        fullName: typeof parsed.fullName === "string" ? parsed.fullName.trim() : "",
        birthDate: typeof parsed.birthDate === "string" ? parsed.birthDate.trim() : "",
        guardianName:
          typeof parsed.guardianName === "string" && parsed.guardianName.trim()
            ? parsed.guardianName.trim()
            : conversation.contact_name || "",
        guardianPhone:
          typeof parsed.guardianPhone === "string" && parsed.guardianPhone.trim()
            ? parsed.guardianPhone.trim()
            : phoneFormatted,
        guardianRelationship: ["Mãe", "Pai", "Avó/Avô", "Tio(a)", "Responsável"].includes(
          String(parsed.guardianRelationship),
        )
          ? String(parsed.guardianRelationship)
          : "Mãe",
        origin: ["WhatsApp", "Instagram", "Google", "Indicação", "Plano de Saúde", "Outro"].includes(
          String(parsed.origin),
        )
          ? String(parsed.origin)
          : "WhatsApp",
        chiefComplaint: typeof parsed.chiefComplaint === "string" ? parsed.chiefComplaint.trim() : "",
      };

      return { success: true as const, data: extracted };
    }
  } catch (e) {
    console.error("Erro ao extrair dados do chat com Gemini:", e);
  }

  return { success: true as const, data: fallbackData };
}

