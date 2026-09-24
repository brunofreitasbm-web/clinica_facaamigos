"use server";

import { handleTwilioIncomingMessage, getAcceptedInsurersFormatted } from "@/lib/twilio";
import { createClient } from "@/lib/supabase/server";

export interface ChatbotTestResult {
  success: boolean;
  intent: string;
  replyMessage: string;
  error?: string;
}

// Só supervisor/gestor pode disparar o pipeline real do chatbot a partir do
// testador — sem isso, qualquer pessoa com a URL da action conseguia injetar
// mensagens "inbound" em conversas reais (inclusive de um número/lead já em
// andamento), gastar quota do Gemini e disparar escalonamento.
async function assertCanManageChatbot(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "Não autorizado.";

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "supervisor" && profile?.role !== "gestor") {
    return "Não autorizado.";
  }

  return null;
}

export async function testTwilioChatbotResponseAction(
  simulatedMessage: string,
  mediaUrl?: string,
  // Número simulado (E.164, sem prefixo "whatsapp:") — permite testar um
  // fluxo já em andamento pra um telefone específico (ex.: um lead de
  // acolhimento de plano de saúde aguardando documentos), em vez de sempre
  // cair no número fixo de teste. Opcional: sem informar, comportamento
  // idêntico ao anterior.
  from?: string,
): Promise<ChatbotTestResult> {
  const authError = await assertCanManageChatbot();
  if (authError) {
    return { success: false, intent: "error", replyMessage: "", error: authError };
  }

  try {
    if ((!simulatedMessage || simulatedMessage.trim().length === 0) && !mediaUrl) {
      return {
        success: false,
        intent: "invalid",
        replyMessage: "",
        error: "Digite uma mensagem ou informe uma URL de mídia para testar.",
      };
    }

    const result = await handleTwilioIncomingMessage({
      from: from ? `whatsapp:${from}` : "whatsapp:+5511999999999",
      body: simulatedMessage,
      // Simula um anexo (foto/PDF) — usado pra testar o "cadastro assistido
      // por IA" (lib/registration-drafts-ingest.ts) sem precisar de um número
      // real de WhatsApp. A URL informada precisa ser pública (o download
      // não usa Basic Auth do Twilio quando testado assim).
      media: mediaUrl ? [{ url: mediaUrl, contentType: mediaUrl.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg" }] : undefined,
    });

    return {
      success: true,
      intent: result.intent,
      replyMessage: result.replyMessage,
    };
  } catch (error) {
    console.error("[Chatbot Action Error]:", error);
    return {
      success: false,
      intent: "error",
      replyMessage: "",
      error: error instanceof Error ? error.message : "Erro ao processar mensagem do chatbot",
    };
  }
}

export async function getTwilioChatbotInsurersAction(): Promise<string> {
  const authError = await assertCanManageChatbot();
  if (authError) throw new Error(authError);
  return await getAcceptedInsurersFormatted();
}
