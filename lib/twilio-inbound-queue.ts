import { createAdminClient } from "@/lib/supabase/admin";
import type { InboundTwilioPayload } from "@/lib/twilio-inbound";

export const INBOUND_MAX_ATTEMPTS = 5;

// A tabela é nova e ainda não consta em database.types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queue = () => (createAdminClient() as any).from("twilio_inbound_queue");

/**
 * Grava o payload na fila (idempotente por MessageSid: reentrega da Twilio ou
 * da função de fallback não duplica). Devolve a chave da linha, ou null se a
 * gravação falhou — quem chama decide processar direto.
 */
export async function enqueueInbound(
  payload: InboundTwilioPayload,
  source: "app" | "fallback",
): Promise<string | null> {
  if (!payload.messageSid) return null;
  try {
    const { error } = await queue().upsert(
      { message_sid: payload.messageSid, payload, source },
      { onConflict: "message_sid", ignoreDuplicates: true },
    );
    if (error) {
      console.error("[Twilio Inbound Queue] enqueue falhou:", error);
      return null;
    }
    return payload.messageSid;
  } catch (err) {
    console.error("[Twilio Inbound Queue] enqueue falhou:", err);
    return null;
  }
}

/** done = processada; pending = volta para a fila (incrementa tentativas e guarda o erro). */
export async function markInbound(messageSid: string, status: "done" | "pending", err?: unknown): Promise<void> {
  try {
    if (status === "done") {
      await queue().update({ status: "done", processed_at: new Date().toISOString(), last_error: null }).eq("message_sid", messageSid);
      return;
    }
    const { data } = await queue().select("attempts").eq("message_sid", messageSid).maybeSingle();
    const attempts = (data?.attempts ?? 0) + 1;
    await queue()
      .update({
        status: attempts >= INBOUND_MAX_ATTEMPTS ? "failed" : "pending",
        attempts,
        last_error: err instanceof Error ? err.message.slice(0, 500) : String(err ?? "").slice(0, 500),
      })
      .eq("message_sid", messageSid);
  } catch (e) {
    console.error("[Twilio Inbound Queue] mark falhou:", e);
  }
}
