/**
 * Módulo de Integração com Google Gemini AI API
 * Suporta modelos de texto e visão/multimodal via REST API oficial (gemini-1.5-flash / gemini-2.0-flash)
 */

export interface GeminiResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface GeminiChatOptions {
  prompt: string;
  systemInstruction?: string;
  conversationHistory?: Array<{ role: "user" | "model"; content: string }>;
  temperature?: number;
}

export interface DocumentAnalysisResult {
  success: boolean;
  patientName?: string;
  cpf?: string;
  insurerName?: string;
  documentType?: "laudo" | "guia" | "carteirinha" | "outro";
  rawSummary?: string;
  error?: string;
}

/**
  * Verifica se a chave de API do Gemini está configurada no ambiente.
  */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 5);
}

/**
 * Endpoint padrão da API Gemini (REST API v1beta)
 */
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Gera uma resposta de chat inteligente usando o Google Gemini AI.
 */
export async function generateGeminiChatResponse(options: GeminiChatOptions): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !isGeminiConfigured()) {
    return {
      success: false,
      error: "GEMINI_API_KEY não configurada no .env.local",
    };
  }

  try {
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // Adicionar histórico de conversa caso exista
    if (options.conversationHistory && options.conversationHistory.length > 0) {
      for (const msg of options.conversationHistory) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Adicionar mensagem atual do usuário
    contents.push({
      role: "user",
      parts: [{ text: options.prompt }],
    });

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: 800,
      },
    };

    // Adicionar instrução de sistema (persona)
    if (options.systemInstruction) {
      payload["systemInstruction"] = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const url = `${GEMINI_BASE_URL}?key=${apiKey.trim()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Gemini API Error ${res.status}]:`, errorText);
      return {
        success: false,
        error: `Erro HTTP na API Gemini: ${res.status}`,
      };
    }

    const data = await res.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!generatedText) {
      return {
        success: false,
        error: "Resposta vazia retornada pelo Gemini",
      };
    }

    return {
      success: true,
      text: generatedText.trim(),
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Gemini Chat Exception]:", errMsg);
    return {
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Classifica a intenção da mensagem do usuário usando o Gemini AI.
 */
export async function classifyUserIntentWithGemini(userMessage: string): Promise<string> {
  if (!isGeminiConfigured()) {
    return "desconhecido";
  }

  const systemInstruction = `Você é o classificador de intenções da clínica de desenvolvimento infantil.
Dada a mensagem do usuário via WhatsApp, classifique em EXATAMENTE uma das seguintes categorias:
- AGENDAMENTO (para pedidos de agendar avaliação, consulta, anamnese, marcar horário)
- PLANOS_SAUDE (para perguntas sobre convênios aceitos, reembolsos, cobertura)
- ENVIO_DOCUMENTO (para mensagens que mencionam envio de laudo, guia, receita, documento)
- DUVIDA_GERAL (para perguntas sobre localização, funcionamento, terapias, ABA, valores ou atendimento humano)

Responda APENAS com a palavra da categoria em maiúsculas (ex: AGENDAMENTO).`;

  const res = await generateGeminiChatResponse({
    prompt: userMessage,
    systemInstruction,
    temperature: 0.1,
  });

  if (!res.success || !res.text) return "DUVIDA_GERAL";

  const upper = res.text.trim().toUpperCase();
  if (upper.includes("AGENDAMENTO")) return "AGENDAMENTO";
  if (upper.includes("PLANOS_SAUDE")) return "PLANOS_SAUDE";
  if (upper.includes("ENVIO_DOCUMENTO")) return "ENVIO_DOCUMENTO";
  return "DUVIDA_GERAL";
}

/**
 * Analisa e extrai dados de laudos, guias ou carteirinhas usando visão/multimodal do Gemini.
 */
export async function analyzeMedicalDocumentWithGemini(
  base64Data: string,
  mimeType: string
): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !isGeminiConfigured()) {
    return {
      success: false,
      error: "GEMINI_API_KEY não configurada.",
    };
  }

  try {
    const prompt = `Analise a imagem/documento médico anexo e extraia os seguintes dados em formato JSON estrito:
{
  "patientName": "Nome completo do paciente se encontrado ou null",
  "cpf": "CPF se encontrado ou null",
  "insurerName": "Nome do plano de saúde/convênio se encontrado ou null",
  "documentType": "laudo" | "guia" | "carteirinha" | "outro",
  "rawSummary": "Resumo em 1 frase curta do conteúdo"
}
Responda APENAS o JSON válido sem nenhum texto adicional.`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const url = `${GEMINI_BASE_URL}?key=${apiKey.trim()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { success: false, error: `Erro na análise visual Gemini: ${res.status}` };
    }

    const data = await res.json();
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(jsonText);

    return {
      success: true,
      patientName: parsed.patientName || undefined,
      cpf: parsed.cpf || undefined,
      insurerName: parsed.insurerName || undefined,
      documentType: parsed.documentType || "outro",
      rawSummary: parsed.rawSummary || "Documento analisado.",
    };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[Gemini Document Analysis Error]:", errMessage);
    return {
      success: false,
      error: errMessage,
    };
  }
}
