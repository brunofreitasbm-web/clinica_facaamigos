// lib/ai-usage.ts
// Registro de uso das APIs de IA (Gemini e Anthropic) em `ai_usage_log`
// (migration 20260921000000). O custo em R$ é calculado nas views do Metabase
// (`metabase_ai_*`) a partir de `ai_model_prices`, não aqui — este módulo só
// grava tokens, status e latência.
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";

/** Chave estável de "onde a IA foi usada" — vira a dimensão do dashboard. */
export type AiFeature =
  | "faq_whatsapp"
  | "pre_cadastro_conversa"
  | "classificacao_intencao"
  | "analise_documento"
  | "extracao_cadastro"
  | "extracao_laudo"
  | "importacao_convenio"
  | "evolucao_voz"
  | "relatorio_devolutiva";

export interface AiUsageEntry {
  provider: "gemini" | "anthropic";
  model: string;
  feature: AiFeature;
  inputTokens?: number;
  /** Subconjunto de `inputTokens` que foi áudio (Gemini cobra por modalidade). */
  audioInputTokens?: number;
  outputTokens?: number;
  /** Gemini devolve o "thinking" separado da saída, mas cobra como saída. */
  thinkingTokens?: number;
  httpStatus?: number;
  success: boolean;
  latencyMs?: number;
  clinicId?: string;
}

/**
 * Grava uma chamada de IA. Nunca lança: contabilizar custo não pode derrubar o
 * atendimento nem a extração. Deve ser `await`ada — em serverless, uma promise
 * solta pode ser congelada antes do insert terminar.
 */
export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("ai_usage_log").insert({
      clinic_id: entry.clinicId ?? DEV_CLINIC_ID,
      provider: entry.provider,
      model: entry.model,
      feature: entry.feature,
      input_tokens: entry.inputTokens ?? 0,
      audio_input_tokens: entry.audioInputTokens ?? 0,
      output_tokens: entry.outputTokens ?? 0,
      thinking_tokens: entry.thinkingTokens ?? 0,
      http_status: entry.httpStatus ?? null,
      success: entry.success,
      latency_ms: entry.latencyMs ?? null,
    });
    if (error) console.error("[AI Usage] Falha ao gravar uso de IA:", error.message);
  } catch (err) {
    console.error("[AI Usage] Falha ao gravar uso de IA:", err instanceof Error ? err.message : err);
  }
}
