/**
 * Orquestrador Cumulativo de IA para Chat e CRM
 *
 * Suporta Google Gemini e DeepSeek com failover transparente, permitindo que a clínica
 * mantenha alta disponibilidade nas automações de WhatsApp e no CRM de atendimento.
 */

import {
  generateGeminiChatResponse,
  isGeminiConfigured,
  GEMINI_MODEL,
  type GeminiChatOptions,
} from "@/lib/gemini";
import {
  generateDeepSeekChatResponse,
  isDeepSeekConfigured,
  DEEPSEEK_DEFAULT_MODEL,
  type DeepSeekChatOptions,
} from "@/lib/deepseek";
import type { AiFeature } from "@/lib/ai-usage";

export type AiProviderPreference = "auto" | "gemini" | "deepseek";

export interface AiChatOptions {
  prompt: string;
  systemInstruction?: string;
  conversationHistory?: Array<{ role: "user" | "model" | "assistant" | "system"; content: string }>;
  temperature?: number;
  jsonMode?: boolean;
  feature: AiFeature;
  /** Permite forçar o provider por chamada (ex: em testes ou rotinas específicas) */
  preferredProvider?: AiProviderPreference;
}

export interface AiChatResponse {
  success: boolean;
  text?: string;
  error?: string;
  providerUsed?: "gemini" | "deepseek";
  modelUsed?: string;
  fallbackTriggered?: boolean;
}

/**
 * Retorna se ao menos um dos provedores de IA está disponível para chat/CRM.
 */
export function isAiChatConfigured(): boolean {
  return isGeminiConfigured() || isDeepSeekConfigured();
}

/**
 * Retorna o status de configuração de cada provedor no ambiente.
 */
export function getAiChatProvidersStatus(): {
  gemini: boolean;
  deepseek: boolean;
  activePreference: AiProviderPreference;
} {
  const envPref = (process.env.AI_CHAT_PROVIDER ?? "auto").toLowerCase();
  const activePreference: AiProviderPreference =
    envPref === "deepseek" ? "deepseek" : envPref === "gemini" ? "gemini" : "auto";

  return {
    gemini: isGeminiConfigured(),
    deepseek: isDeepSeekConfigured(),
    activePreference,
  };
}

/**
 * Gera resposta de chat ou extração com fallback cumulativo entre Gemini e DeepSeek.
 * Se o provedor principal falhar (status HTTP de erro, timeout ou indisponibilidade),
 * a requisição é automaticamente roteada para o provedor secundário.
 */
export async function generateAiChatResponse(options: AiChatOptions): Promise<AiChatResponse> {
  const { gemini: hasGemini, deepseek: hasDeepSeek, activePreference } = getAiChatProvidersStatus();
  const pref = options.preferredProvider ?? activePreference;

  if (!hasGemini && !hasDeepSeek) {
    return {
      success: false,
      error: "Nenhum provedor de IA configurado (defina GEMINI_API_KEY ou DEEPSEEK_API_KEY).",
    };
  }

  // Define ordem de tentativa conforme preferência e disponibilidade
  let primary: "deepseek" | "gemini";
  if (pref === "deepseek") {
    primary = hasDeepSeek ? "deepseek" : "gemini";
  } else if (pref === "gemini") {
    primary = hasGemini ? "gemini" : "deepseek";
  } else {
    // "auto": se DeepSeek estiver configurado e Gemini também, usa preferencialmente DeepSeek ou Gemini
    primary = hasDeepSeek ? "deepseek" : "gemini";
  }

  const secondary = primary === "deepseek" ? "gemini" : "deepseek";

  // 1ª Tentativa com o Provedor Primário
  const primaryResult = await callProvider(primary, options);
  if (primaryResult.success && primaryResult.text) {
    return {
      success: true,
      text: primaryResult.text,
      providerUsed: primary,
      modelUsed: primary === "deepseek" ? DEEPSEEK_DEFAULT_MODEL : GEMINI_MODEL,
      fallbackTriggered: false,
    };
  }

  // Se o secundário não estiver configurado, retorna o erro do primário
  const secondaryAvailable = secondary === "deepseek" ? hasDeepSeek : hasGemini;
  if (!secondaryAvailable) {
    return {
      success: false,
      error: primaryResult.error || `Falha na chamada com ${primary}`,
      providerUsed: primary,
      modelUsed: primary === "deepseek" ? DEEPSEEK_DEFAULT_MODEL : GEMINI_MODEL,
      fallbackTriggered: false,
    };
  }

  // 2ª Tentativa cumulativa (Failover transparente para o Provedor Secundário)
  console.warn(
    `[AI Chat Failover] Provedor primário (${primary}) falhou: ${primaryResult.error}. Acionando ${secondary} cumulativamente...`,
  );

  const secondaryResult = await callProvider(secondary, options);
  if (secondaryResult.success && secondaryResult.text) {
    return {
      success: true,
      text: secondaryResult.text,
      providerUsed: secondary,
      modelUsed: secondary === "deepseek" ? DEEPSEEK_DEFAULT_MODEL : GEMINI_MODEL,
      fallbackTriggered: true,
    };
  }

  return {
    success: false,
    error: `Ambos os provedores falharam. [${primary}]: ${primaryResult.error} | [${secondary}]: ${secondaryResult.error}`,
    fallbackTriggered: true,
  };
}

async function callProvider(
  provider: "gemini" | "deepseek",
  options: AiChatOptions,
): Promise<{ success: boolean; text?: string; error?: string }> {
  if (provider === "deepseek") {
    const deepseekOpts: DeepSeekChatOptions = {
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      conversationHistory: options.conversationHistory,
      temperature: options.temperature,
      jsonMode: options.jsonMode,
      feature: options.feature,
    };
    return generateDeepSeekChatResponse(deepseekOpts);
  }

  // Adaptar histórico para o padrão Gemini ("user" | "model")
  const geminiHistory = options.conversationHistory?.map((msg) => ({
    role: msg.role === "assistant" || msg.role === "model" ? ("model" as const) : ("user" as const),
    content: msg.content,
  }));

  const geminiOpts: GeminiChatOptions = {
    prompt: options.prompt,
    systemInstruction: options.systemInstruction,
    conversationHistory: geminiHistory,
    temperature: options.temperature,
    jsonMode: options.jsonMode,
    feature: options.feature,
  };

  return generateGeminiChatResponse(geminiOpts);
}
