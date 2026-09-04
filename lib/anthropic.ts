import Anthropic from "@anthropic-ai/sdk";

/**
 * Client Anthropic server-only (PRD §9 — agente IA de consolidação de
 * relatórios). Mesmo padrão de createAdminClient (lib/supabase/admin.ts):
 * lança se a env var não estiver configurada, pra a Server Action decidir
 * a mensagem de erro amigável em vez de estourar um 500 cru.
 */
export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }
  return new Anthropic({ apiKey });
}

// Modelo atual recomendado pra geração de texto (ver diretrizes internas de
// "sempre usar o modelo mais recente") — mantido num único lugar pra
// atualizar sem caçar strings espalhadas pelo código.
export const DEVOLUTION_REPORT_MODEL = "claude-sonnet-5";
