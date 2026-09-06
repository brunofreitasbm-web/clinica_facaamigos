"use server";

import { handleTwilioIncomingMessage, getAcceptedInsurersFormatted } from "@/lib/twilio";

export interface ChatbotTestResult {
  success: boolean;
  intent: string;
  replyMessage: string;
  error?: string;
}

export async function testTwilioChatbotResponseAction(simulatedMessage: string): Promise<ChatbotTestResult> {
  try {
    if (!simulatedMessage || simulatedMessage.trim().length === 0) {
      return {
        success: false,
        intent: "invalid",
        replyMessage: "",
        error: "Por favor, digite uma mensagem para testar.",
      };
    }

    const result = await handleTwilioIncomingMessage({
      from: "whatsapp:+5511999999999",
      body: simulatedMessage,
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
