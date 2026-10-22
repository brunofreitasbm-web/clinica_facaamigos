/**
 * Módulo de Integração com a API DeepSeek (Compatível com OpenAI REST API v1)
 *
 * Suporta configuração cumulativa com múltiplas APIs/chaves:
 * - DEEPSEEK_CHAT_API_KEY: chave dedicada para o Chat (WhatsApp / FAQ Bot)
 * - DEEPSEEK_CRM_API_KEY: chave dedicada para o CRM (pré-cadastro e extração de leads)
 * - DEEPSEEK_API_KEY: chave geral de contingência / fallback
 *
 * Se uma das chaves falhar (saldo 402, rate limit 429 ou erro transitório),
 * o módulo tenta cumulativamente a outra chave DeepSeek disponível antes
 * do fallback final para o Gemini (em lib/chat-llm.ts).
 */

import { logAiUsage, type AiFeature } from "@/lib/ai-usage";

export interface DeepSeekChatOptions {
  prompt: string;
  systemInstruction?: string;
  conversationHistory?: Array<{ role: "user" | "model" | "assistant" | "system"; content: string }>;
  temperature?: number;
  /** Pede retorno estrito em formato JSON */
  jsonMode?: boolean;
  /** Identificador da feature para apropriação de custos em BI */
  feature: AiFeature;
  /** Modelo customizado (padrão: deepseek-chat) */
  model?: string;
}

export interface DeepSeekResponse {
  success: boolean;
  text?: string;
  error?: string;
  provider: "deepseek";
  model: string;
  keyOrigin?: "chat" | "crm" | "default";
}

export const DEEPSEEK_DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
export const DEEPSEEK_API_URL = process.env.DEEPSEEK_BASE_URL
  ? `${process.env.DEEPSEEK_BASE_URL.replace(/\/+$/, "")}/chat/completions`
  : "https://api.deepseek.com/chat/completions";

/**
 * Retorna as chaves DeepSeek ordenadas por prioridade conforme a feature/contexto.
 */
export function getDeepSeekApiKeys(feature?: AiFeature | "chat" | "crm"): Array<{ key: string; origin: "chat" | "crm" | "default" }> {
  const chatKey = (process.env.DEEPSEEK_CHAT_API_KEY ?? "").trim();
  const crmKey = (process.env.DEEPSEEK_CRM_API_KEY ?? "").trim();
  const defaultKey = (process.env.DEEPSEEK_API_KEY ?? "").trim();

  const isCrmFeature = feature === "crm" || feature === "pre_cadastro_conversa";
  const isChatFeature = feature === "chat" || feature === "faq_whatsapp";

  const candidates: Array<{ key: string; origin: "chat" | "crm" | "default" }> = [];

  if (isCrmFeature) {
    if (crmKey.length > 5) candidates.push({ key: crmKey, origin: "crm" });
    if (defaultKey.length > 5 && defaultKey !== crmKey) candidates.push({ key: defaultKey, origin: "default" });
    if (chatKey.length > 5 && chatKey !== crmKey && chatKey !== defaultKey) candidates.push({ key: chatKey, origin: "chat" });
  } else if (isChatFeature) {
    if (chatKey.length > 5) candidates.push({ key: chatKey, origin: "chat" });
    if (defaultKey.length > 5 && defaultKey !== chatKey) candidates.push({ key: defaultKey, origin: "default" });
    if (crmKey.length > 5 && crmKey !== chatKey && crmKey !== defaultKey) candidates.push({ key: crmKey, origin: "crm" });
  } else {
    if (defaultKey.length > 5) candidates.push({ key: defaultKey, origin: "default" });
    if (chatKey.length > 5 && chatKey !== defaultKey) candidates.push({ key: chatKey, origin: "chat" });
    if (crmKey.length > 5 && crmKey !== defaultKey && crmKey !== chatKey) candidates.push({ key: crmKey, origin: "crm" });
  }

  return candidates;
}

/**
 * Verifica se alguma chave de API do DeepSeek está configurada para o contexto.
 */
export function isDeepSeekConfigured(feature?: AiFeature | "chat" | "crm"): boolean {
  return getDeepSeekApiKeys(feature).length > 0;
}

interface DeepSeekUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

/**
 * Executa a requisição HTTP com uma chave DeepSeek específica e grava a auditoria em ai_usage_log.
 */
export async function deepseekFetchWithKey(
  apiKey: string,
  feature: AiFeature,
  payload: Record<string, unknown>,
  opts?: { signal?: AbortSignal; model?: string },
): Promise<Response> {
  const model = opts?.model || DEEPSEEK_DEFAULT_MODEL;
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: opts?.signal,
    });
  } catch (err) {
    await logAiUsage({
      provider: "deepseek",
      model,
      feature,
      success: false,
      latencyMs: Date.now() - started,
    });
    throw err;
  }

  let usage: DeepSeekUsage | undefined;
  if (res.ok) {
    try {
      const cloned = (await res.clone().json()) as { usage?: DeepSeekUsage };
      usage = cloned?.usage;
    } catch {
      // Ignora erro de parsing no clone
    }
  }

  await logAiUsage({
    provider: "deepseek",
    model,
    feature,
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    httpStatus: res.status,
    success: res.ok,
    latencyMs: Date.now() - started,
  });

  return res;
}

/**
 * Executa requisição com fallback para a chave padrão caso a principal não responda.
 */
export async function deepseekFetch(
  feature: AiFeature,
  payload: Record<string, unknown>,
  opts?: { signal?: AbortSignal; model?: string },
): Promise<Response> {
  const keyCandidates = getDeepSeekApiKeys(feature);
  if (keyCandidates.length === 0) {
    throw new Error("Nenhuma DEEPSEEK_API_KEY configurada.");
  }

  return deepseekFetchWithKey(keyCandidates[0].key, feature, payload, opts);
}

/**
 * Gera resposta de chat ou extração usando as chaves DeepSeek cumulativamente.
 * Se a chave primária retornar 402 (saldo insuficiente), 429 (rate limit) ou erro de rede,
 * tenta automaticamente a próxima chave DeepSeek configurada no pool antes de desistir.
 */
export async function generateDeepSeekChatResponse(
  options: DeepSeekChatOptions,
): Promise<DeepSeekResponse> {
  const model = options.model || DEEPSEEK_DEFAULT_MODEL;
  const keyCandidates = getDeepSeekApiKeys(options.feature);

  if (keyCandidates.length === 0) {
    return {
      success: false,
      error: "Nenhuma chave DeepSeek configurada (verifique DEEPSEEK_CHAT_API_KEY, DEEPSEEK_CRM_API_KEY ou DEEPSEEK_API_KEY).",
      provider: "deepseek",
      model,
    };
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (options.systemInstruction) {
    messages.push({
      role: "system",
      content: options.systemInstruction,
    });
  }

  if (options.conversationHistory && options.conversationHistory.length > 0) {
    for (const msg of options.conversationHistory) {
      let role: "system" | "user" | "assistant" = "user";
      if (msg.role === "system") role = "system";
      else if (msg.role === "model" || msg.role === "assistant") role = "assistant";
      messages.push({
        role,
        content: msg.content,
      });
    }
  }

  messages.push({
    role: "user",
    content: options.prompt,
  });

  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.4,
    stream: false,
  };

  if (options.jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  let lastError = "";

  // Tenta cumulativamente cada chave configurada (ex: Chat -> Default -> CRM)
  for (let i = 0; i < keyCandidates.length; i++) {
    const { key, origin } = keyCandidates[i];

    try {
      const res = await deepseekFetchWithKey(key, options.feature, payload, { model });

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || "";

        if (content) {
          return {
            success: true,
            text: content.trim(),
            provider: "deepseek",
            model,
            keyOrigin: origin,
          };
        }
      }

      // Em erro 402/429 ou 5xx, avisa no log e tenta a próxima chave se houver
      const errorText = await res.text();
      lastError = `DeepSeek [${origin}] HTTP ${res.status}: ${errorText.slice(0, 150)}`;
      console.warn(`[DeepSeek Multi-Key] Falha na chave ${origin} (HTTP ${res.status}). Tentando chave cumulativa seguinte...`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[DeepSeek Multi-Key] Exceção na chave ${origin}: ${lastError}. Tentando chave cumulativa seguinte...`);
    }
  }

  return {
    success: false,
    error: lastError || "Todas as chaves DeepSeek cumulativas falharam.",
    provider: "deepseek",
    model,
  };
}
