// lib/whatsapp/llm.ts
/**
 * Interface mínima de LLM pro bot — usado só para (a) classificar texto
 * livre que não bate com nenhuma opção do menu e (b) uma triagem best-effort
 * do PDF enviado (parece laudo? parece guia? tem nº de guia/vigência?). O
 * bot NUNCA depende do LLM pra avançar de estado — na ausência dele
 * (`isBotLlmEnabled()===false`, timeout, erro), sempre há um fallback
 * determinístico (reenviar o menu; deixar `llm_check` vazio pro supervisor
 * conferir manualmente).
 *
 * Implementação com Gemini (`@google/genai`) — decisão do dono da clínica.
 * Nunca recebe CPF/telefone: só o texto da mensagem do usuário ou o PDF.
 */
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, isBotLlmEnabled } from "./env";

export type BotIntent =
  | "agendar"
  | "convenios"
  | "documentos"
  | "avaliacao"
  | "endereco"
  | "humano"
  | "confirmar"
  | "reagendar"
  | "outro";

export type PdfInspection = {
  kind: "laudo" | "guia" | "outro";
  guideNumber?: string;
  procedureCode?: string;
  sessionsAuthorized?: number;
  validTo?: string;
};

export type BotLlm = {
  classifyIntent(text: string): Promise<BotIntent | null>;
  inspectPdf(buffer: Buffer, expectedKind: "laudo" | "guia"): Promise<PdfInspection | null>;
};

const INTENTS: BotIntent[] = [
  "agendar",
  "convenios",
  "documentos",
  "avaliacao",
  "endereco",
  "humano",
  "confirmar",
  "reagendar",
  "outro",
];

const TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("LLM timeout")), ms)),
  ]);
}

function makeGeminiLlm(apiKey: string): BotLlm {
  const client = new GoogleGenAI({ apiKey });
  const model = "gemini-2.0-flash";

  return {
    async classifyIntent(text) {
      try {
        const response = await withTimeout(
          client.models.generateContent({
            model,
            contents: `Classifique a mensagem de um responsável de paciente de uma clínica infantil em uma destas categorias: ${INTENTS.join(", ")}. Responda só com a categoria, nada mais.\n\nMensagem: "${text}"`,
          }),
          TIMEOUT_MS,
        );
        const answer = (response.text ?? "").trim().toLowerCase();
        const found = INTENTS.find((intent) => answer.includes(intent));
        return found ?? null;
      } catch {
        return null;
      }
    },

    async inspectPdf(buffer, expectedKind) {
      try {
        const response = await withTimeout(
          client.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Este PDF deveria ser um(a) "${expectedKind}" (laudo médico ou guia/autorização de convênio) de uma clínica infantil. Responda em JSON estrito, sem markdown, com os campos: {"kind": "laudo"|"guia"|"outro", "guideNumber"?: string, "procedureCode"?: string, "sessionsAuthorized"?: number, "validTo"?: "YYYY-MM-DD"}. Se não conseguir ler ou não for nenhum dos dois, use kind:"outro".`,
                  },
                  { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
                ],
              },
            ],
          }),
          TIMEOUT_MS,
        );
        const raw = (response.text ?? "").trim().replace(/^```json|```$/g, "");
        const parsed = JSON.parse(raw) as PdfInspection;
        if (!["laudo", "guia", "outro"].includes(parsed.kind)) return null;
        return parsed;
      } catch {
        return null;
      }
    },
  };
}

/** Retorna `null` se o LLM estiver desligado (BOT_LLM_ENABLED != 'true' ou sem chave) — o chamador trata como "sem triagem disponível". */
export function getBotLlm(): BotLlm | null {
  if (!isBotLlmEnabled()) return null;
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return makeGeminiLlm(apiKey);
}
