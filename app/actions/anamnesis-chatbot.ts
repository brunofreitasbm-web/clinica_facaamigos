"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone, sendTwilioWhatsApp } from "@/lib/twilio";
import { revalidatePath } from "next/cache";

export interface AnamnesisRequestItem {
  id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_cpf: string;
  child_name: string;
  laudo_pdf_url?: string | null;
  guia_pdf_url?: string | null;
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

    const { data: inserted, error } = await supabase
      .from("anamnesis_scheduling_requests")
      .insert({
        guardian_name: mockGuardian,
        guardian_phone: mockPhone,
        guardian_cpf: mockCpf,
        child_name: mockChild,
        status: "pendente_supervisor",
        laudo_pdf_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        guia_pdf_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
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
      `🎉 *DOCUMENTAÇÃO APROVADA PELO SUPERVISOR!*\n\n` +
      `Olá, *${req.guardian_name}*! Os documentos (Laudo e Guia) da criança *${req.child_name}* foram validados pelo nosso supervisor clínico.\n\n` +
      `Por favor, responda com o **NÚMERO** correspondente ao horário que prefere agendar:\n\n` +
      `${slotListText}\n\n` +
      `Responda apenas com o número escolhido (ex: 1, 2...).`;

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

    // Resetar sessão do chatbot para re-tentativa
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_has_laudo",
        collected_data: {},
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", formattedPhone);

    const messageText =
      `⚠️ *SOLICITAÇÃO DE AJUSTE DE DOCUMENTAÇÃO*\n\n` +
      `Olá, *${req.guardian_name}*. O nosso supervisor analisou a documentação de *${req.child_name}* e identificou a seguinte pendência:\n\n` +
      `📌 *Motivo:* ${rejectionReason}\n\n` +
      `Por favor, providencie a correção e nos envie uma nova mensagem por aqui quando estiver com o documento em mãos.`;

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
