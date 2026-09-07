"use server";

import { handleTwilioIncomingMessage, getAcceptedInsurersFormatted } from "@/lib/twilio";

export interface ChatbotTestResult {
  success: boolean;
  intent: string;
  replyMessage: string;
  error?: string;
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
  return await getAcceptedInsurersFormatted();
}
