"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp } from "@/lib/twilio";
import { buildStoragePointer } from "@/lib/whatsapp-media-pure";
import { revalidatePath } from "next/cache";

export interface AnamnesisRequestItem {
  id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_cpf: string;
  child_name: string;
  laudo_pdf_url?: string | null;
  guia_pdf_url?: string | null;
  carteirinha_frente_url?: string | null;
  carteirinha_verso_url?: string | null;
  card_number?: string | null;
  is_private?: boolean;
  status: "pendente_supervisor" | "aprovado" | "rejeitado" | "agendado" | "cancelado";
  rejection_reason?: string | null;
  created_at: string;
  selected_slot_starts_at?: string | null;
}

/**
 * Busca todas as solicitações de agendamento de anamnese/avaliação.
 */
export async function getPendingAnamnesisRequestsAction(): Promise<{
  success: boolean;
  requests?: AnamnesisRequestItem[];
  error?: string;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    const { data, error } = await supabase
      .from("anamnesis_scheduling_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      requests: (data as AnamnesisRequestItem[]) || [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// PDF mínimo (uma página em branco) para o mock: mesmo formato de ponteiro que o
// bot grava de verdade (`storage://clinic-documents/<path>`), sem depender de
// URL externa. Um único objeto fixo, regravado a cada chamada (upsert).
const MOCK_PDF_PATH = "mock/anamnese-teste.pdf";
const MOCK_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R/Size 4>>\n%%EOF\n",
);

/**
 * Cria uma solicitação de paciente fictício vindo do WhatsApp para testes na fila de validação.
 */
export async function createMockWhatsAppAnamnesisRequestAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    const mockPhone = "+5511987654321";
    const mockChild = "Lucas Gabriel Santana";
    const mockGuardian = "Mariana Santana";
    const mockCpf = "123.456.789-00";

    // Sem o arquivo no Storage o ponteiro não abriria — nesse caso fica sem anexo.
    const { error: mockUploadError } = await supabase.storage
      .from("clinic-documents")
      .upload(MOCK_PDF_PATH, MOCK_PDF_BYTES, { contentType: "application/pdf", upsert: true });
    const mockPointer = mockUploadError ? null : buildStoragePointer(MOCK_PDF_PATH);

    const { data: inserted, error } = await supabase
      .from("anamnesis_scheduling_requests")
      .insert({
        guardian_name: mockGuardian,
        guardian_phone: mockPhone,
        guardian_cpf: mockCpf,
        child_name: mockChild,
        status: "pendente_supervisor",
        laudo_pdf_url: mockPointer,
        guia_pdf_url: mockPointer,
        carteirinha_frente_url: mockPointer,
        carteirinha_verso_url: mockPointer,
        card_number: "0088123456789001",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Criar ou atualizar sessão fictícia no chatbot
    await supabase.from("chatbot_sessions").upsert(
      {
        phone_number: mockPhone,
        current_step: "awaiting_laudo",
        collected_data: {
          child_name: mockChild,
          guardian_name: mockGuardian,
          guardian_cpf: mockCpf,
          request_id: inserted.id,
          canal: "WhatsApp Direct",
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone_number" }
    );

    revalidatePath("/supervisao");
    revalidatePath("/recepcao");

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Auxiliar: gera slots vagos simulados baseados na agenda dos terapeutas/supervisores.
 */
async function generateAvailableSlotsForSupervisor() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Buscar um terapeuta/supervisor padrão e sala
  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .limit(1);

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .limit(1);

  const defaultTherapistId = therapists?.[0]?.id || "p0000000-0000-0000-0000-000000000002";
  const defaultRoomId = rooms?.[0]?.id || "r0000000-0000-0000-0000-000000000001";

  const slots = [];
  const now = new Date();
  
  // Criar 4 opções de horários para os próximos dias
  const offsetsDays = [1, 2, 3, 4];
  const hours = [9, 14, 15, 16];

  let index = 1;
  for (let i = 0; i < offsetsDays.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offsetsDays[i]);
    date.setHours(hours[i], 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(date.getHours() + 1);

    const formattedLabel = date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    slots.push({
      index: index++,
      label: formattedLabel,
      starts_at: date.toISOString(),
      ends_at: endDate.toISOString(),
      therapist_id: defaultTherapistId,
      room_id: defaultRoomId,
    });
  }

  return slots;
}

/**
 * Aprova o Laudo/Guia e dispara via WhatsApp os horários vagos disponíveis.
 */
export async function approveAnamnesisDocumentAction(
  requestId: string,
  supervisorId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // 1. Buscar dados da requisição
    const { data: req, error: reqErr } = await supabase
      .from("anamnesis_scheduling_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqErr || !req) {
      return { success: false, error: "Solicitação não encontrada." };
    }

    // 2. Atualizar status da requisição
    await supabase
      .from("anamnesis_scheduling_requests")
      .update({
        status: "aprovado",
        supervisor_id: supervisorId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    // 3. Gerar slots disponíveis
    const slots = await generateAvailableSlotsForSupervisor();

    const formattedPhone = formatE164Phone(req.guardian_phone);

    // 4. Atualizar sessão do chatbot para aguardar a escolha do slot
    const { data: session } = await supabase
      .from("chatbot_sessions")
      .select("*")
      .eq("phone_number", formattedPhone)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collected = (session?.collected_data as Record<string, any>) || {};
    collected.request_id = requestId;
    collected.child_name = req.child_name;
    collected.guardian_name = req.guardian_name;
    collected.available_slots = slots;

    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_slot_selection",
        collected_data: collected,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", formattedPhone);

    // 5. Enviar mensagem de WhatsApp via Twilio com a lista de horários
    const slotListText = slots
      .map((s) => `*${s.index}* - ${s.label}`)
      .join("\n");

    const messageText =
      `🎉 *DOCUMENTAÇÃO APROVADA!*\n\n` +
      `Olá, *${req.guardian_name}*! Os documentos de *${req.child_name}* foram validados. 💙\n\n` +
      `Escolha o horário para agendar:\n\n` +
      `${slotListText}\n\n` +
      `Responda apenas com o número desejado (ex: 1).`;

    await sendTwilioWhatsApp({
      to: formattedPhone.replace("whatsapp:", ""),
      message: messageText,
    });

    revalidatePath("/supervisao");
    revalidatePath("/recepcao");

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Rejeita os documentos informando o motivo e avisa o responsável via WhatsApp.
 */
export async function rejectAnamnesisDocumentAction(
  requestId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    const { data: req, error: reqErr } = await supabase
      .from("anamnesis_scheduling_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqErr || !req) {
      return { success: false, error: "Solicitação não encontrada." };
    }

    await supabase
      .from("anamnesis_scheduling_requests")
      .update({
        status: "rejeitado",
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    const formattedPhone = formatE164Phone(req.guardian_phone);

    // Resetar sessão do chatbot para re-tentativa. Descarta só o que será
    // reenviado (documentos, cartão, requisição); preserva a identidade
    // coletada e o `lead_patient_id`, para o reenvio cair no MESMO paciente-lead
    // em vez de depender de heurística por telefone/nome.
    const { data: session } = await supabase
      .from("chatbot_sessions")
      .select("collected_data")
      .eq("phone_number", formattedPhone)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const previous = (session?.collected_data as Record<string, any>) || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preserved: Record<string, any> = {};
    const identityKeys = [
      "guardian_name",
      "guardian_cpf",
      "guardian_email",
      "child_name",
      "child_birth_date",
      "started_at",
    ];
    for (const key of identityKeys) {
      if (previous[key] !== undefined && previous[key] !== null) preserved[key] = previous[key];
    }
    const leadPatientId = previous.lead_patient_id ?? req.patient_id ?? null;
    if (leadPatientId) preserved.lead_patient_id = leadPatientId;
    // O reenvio é sempre de documentos de convênio.
    preserved.is_private = false;

    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_has_laudo",
        collected_data: preserved,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", formattedPhone);

    const messageText =
      `⚠️ *AJUSTE NA DOCUMENTAÇÃO*\n\n` +
      `Olá, *${req.guardian_name}*. Identificamos uma pendência na documentação de *${req.child_name}*:\n\n` +
      `📌 *Motivo:* ${rejectionReason}\n\n` +
      `Por favor, envie o documento corrigido por aqui assim que puder. 💙`;

    await sendTwilioWhatsApp({
      to: formattedPhone.replace("whatsapp:", ""),
      message: messageText,
    });

    revalidatePath("/supervisao");
    revalidatePath("/recepcao");

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
