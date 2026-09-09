/**
 * Módulo de Integração com Google Gemini AI API
 * Suporta modelos de texto e visão/multimodal via REST API oficial (gemini-1.5-flash / gemini-2.0-flash)
 */

import { BEHAVIOR_INTENSITIES, FAMILY_GUIDANCE_OPTIONS } from "@/lib/session-note-fields";

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
  /** Pede `application/json` na resposta. Usado pelo agente de FAQ do WhatsApp
   * (lib/twilio-faq-bot.ts), que precisa da resposta e da decisão de escalar
   * no mesmo retorno — uma sentinela em texto (`[ESCALAR]`) vazaria para a
   * família quando o modelo errasse o formato. */
  jsonMode?: boolean;
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
 * Resultado cru da transcrição + estruturação de evolução clínica por voz.
 * Os campos espelham `SessionNoteStructured` (lib/session-note-fields.ts)
 * mais `free_text`, mas aqui tudo é OPCIONAL e SEM validação de schema —
 * é só a interpretação do texto que o Gemini devolveu. Quem valida contra
 * os valores permitidos (behavior_catalog da clínica, BEHAVIOR_INTENSITIES,
 * FAMILY_GUIDANCE_OPTIONS) é a rota de API que chama esta função, nunca
 * este módulo — ver app/api/aba/session-note-voice/route.ts.
 */
export interface SessionNoteVoiceSuggestion {
  success: boolean;
  presenca_engajamento?: number;
  comportamentos?: { tipo: string; intensidade: string }[];
  orientacoes?: string[];
  free_text?: string;
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
 *
 * NOTA (validado nesta entrega com chamadas reais à API, ver relatório):
 * "gemini-1.5-flash" foi descontinuado e devolve 404 ("model not found")
 * na chave de API real do projeto — mesmo destino de "gemini-2.5-flash" e
 * "gemini-2.5-flash-lite" ("no longer available to new users"). O alias
 * "gemini-flash-latest" existe e aceita a chamada, mas devolveu 503 (alta
 * demanda) em todas as tentativas durante os testes desta entrega — não é
 * confiável como padrão agora. "gemini-3.5-flash-lite" foi testado de
 * verdade (texto e multimodal com áudio, ver relatório) e respondeu 200
 * de forma rápida e estável, então é o modelo fixado aqui. Isso corrige
 * TODAS as funções deste módulo, não só a nova de voz — as existentes
 * (chat, classificação de intenção, análise de documento) estavam
 * quebradas em produção com o nome antigo.
 */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
        ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
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

/**
 * Transcreve um áudio curto de evolução clínica (relato falado pelo
 * terapeuta ao fim da sessão) E já estrutura o conteúdo nos campos fixos
 * de `session_notes.structured` (lib/session-note-fields.ts) numa única
 * chamada multimodal ao Gemini — o modelo recebe o áudio inline (base64)
 * mais um prompt de sistema listando os valores permitidos e devolve JSON.
 *
 * IMPORTANTE (ver AGENTS.md / regra de "sem fallback fabricado"): esta
 * função NUNCA inventa um resultado de sucesso. Se a chave não estiver
 * configurada, se a chamada HTTP falhar, ou se o Gemini não devolver um
 * JSON parseável, o retorno é `{ success: false, error }` — quem chama
 * (a rota de API) decide a mensagem ao usuário. Os valores devolvidos
 * aqui ainda não passaram por validação contra os enums do schema; isso
 * é responsabilidade de quem consome este resultado.
 */
export async function transcribeAndStructureSessionNote(
  audioBase64: string,
  mimeType: string,
  behaviorCatalogValues: string[],
): Promise<SessionNoteVoiceSuggestion> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !isGeminiConfigured()) {
    return {
      success: false,
      error: "GEMINI_API_KEY não configurada.",
    };
  }

  if (!audioBase64 || !audioBase64.trim()) {
    return {
      success: false,
      error: "Áudio vazio — nada para transcrever.",
    };
  }

  // Lista de comportamentos vem do catálogo da clínica (behavior_catalog,
  // PRD §9.4 "lista configurável"), não mais de um enum fixo — quem busca
  // o catálogo é a rota de API (app/api/aba/session-note-voice/route.ts).
  const behaviorValues = behaviorCatalogValues.join(", ");
  const intensityValues = BEHAVIOR_INTENSITIES.map((i) => i.value).join(", ");
  const orientationValues = FAMILY_GUIDANCE_OPTIONS.map((g) => g.value).join(", ");

  const prompt = `Você é um assistente que ajuda terapeutas de uma clínica de desenvolvimento infantil (ABA) a
registrar a evolução clínica de uma sessão. Ouça o áudio anexo — um relato falado pelo terapeuta logo após o
atendimento — e transcreva o conteúdo, depois estruture-o em formato JSON estrito com EXATAMENTE estas chaves:

{
  "presenca_engajamento": <inteiro de 1 a 5, sua melhor estimativa do nível de presença/engajamento do paciente
    relatado no áudio; use 3 se o áudio não permitir estimar com confiança>,
  "comportamentos": [
    { "tipo": "<um destes valores: ${behaviorValues}>", "intensidade": "<um destes valores: ${intensityValues}>" }
  ],
  "orientacoes": ["<zero ou mais destes valores: ${orientationValues}>"],
  "free_text": "<resumo em texto livre, em português, de 2 a 5 frases, da evolução clínica relatada no áudio —
    isto deve funcionar como o texto de evolução clínica completo, não apenas uma transcrição literal>"
}

Regras importantes:
- Use APENAS os valores literais listados acima para "tipo", "intensidade" e "orientacoes" — nunca invente
  categorias novas. Se um comportamento relatado não se encaixar em nenhum valor, use "outro".
- Se o áudio não mencionar nenhum comportamento-alvo, devolva "comportamentos": [].
- Se o áudio não mencionar nenhuma orientação à família, devolva "orientacoes": [].
- Se o áudio estiver inaudível, vazio, ou não for sobre uma sessão clínica, devolva
  {"presenca_engajamento": null, "comportamentos": [], "orientacoes": [], "free_text": ""} — não invente conteúdo.
- Responda APENAS o JSON válido, sem markdown, sem texto adicional antes ou depois.`;

  try {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || "audio/webm",
                data: audioBase64,
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
      const errorText = await res.text();
      console.error(`[Gemini Voice Session Note Error ${res.status}]:`, errorText);
      return {
        success: false,
        error: `Erro na transcrição por voz (Gemini): HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      return {
        success: false,
        error: "Gemini não devolveu conteúdo transcrito (resposta vazia).",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("[Gemini Voice Session Note] JSON inválido devolvido:", jsonText);
      return {
        success: false,
        error: "A resposta da IA não veio em formato JSON válido.",
      };
    }

    if (typeof parsed !== "object" || parsed === null) {
      return {
        success: false,
        error: "A resposta da IA não veio no formato esperado.",
      };
    }

    const obj = parsed as Record<string, unknown>;

    const comportamentosRaw = Array.isArray(obj.comportamentos) ? obj.comportamentos : [];
    const comportamentos = comportamentosRaw
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        tipo: String(c.tipo ?? ""),
        intensidade: String(c.intensidade ?? ""),
      }));

    const orientacoesRaw = Array.isArray(obj.orientacoes) ? obj.orientacoes : [];
    const orientacoes = orientacoesRaw.map((o) => String(o));

    const presencaRaw = obj.presenca_engajamento;
    const presenca =
      typeof presencaRaw === "number" && Number.isFinite(presencaRaw) ? presencaRaw : undefined;

    return {
      success: true,
      presenca_engajamento: presenca,
      comportamentos,
      orientacoes,
      free_text: typeof obj.free_text === "string" ? obj.free_text : "",
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Gemini Voice Session Note Exception]:", errMsg);
    return {
      success: false,
      error: errMsg,
    };
  }
}
