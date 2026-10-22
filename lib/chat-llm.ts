/**
 * Roteador de LLM para as respostas de chat e CRM: DeepSeek primeiro, Gemini como reserva.
 *
 * Suporta chaves dedicadas/cumulativas (DEEPSEEK_CHAT_API_KEY, DEEPSEEK_CRM_API_KEY e DEEPSEEK_API_KEY).
 * Qualquer falha do DeepSeek (saldo esgotado = 402, rate limit = 429, 5xx, timeout,
 * resposta vazia ou chave ausente) cai no Gemini na mesma chamada — a família ou
 * a recepção nunca fica sem resposta só porque um provedor acabou.
 */

import { generateDeepSeekChatResponse, isDeepSeekConfigured } from "@/lib/deepseek";
import { generateGeminiChatResponse, isGeminiConfigured, type GeminiChatOptions, type GeminiResponse } from "@/lib/gemini";
import type { AiFeature } from "@/lib/ai-usage";

export function isChatAiConfigured(feature?: AiFeature | "chat" | "crm"): boolean {
  return isDeepSeekConfigured(feature) || isGeminiConfigured();
}

export async function generateChatResponse(options: GeminiChatOptions): Promise<GeminiResponse> {
  if (isDeepSeekConfigured(options.feature)) {
    const primary = await generateDeepSeekChatResponse(options);
    if (primary.success && primary.text) return { success: true, text: primary.text };

    console.warn(`[Chat LLM] DeepSeek indisponível (${primary.error ?? "falha"}) — usando Gemini como reserva.`);
  }

  return generateGeminiChatResponse(options);
}
