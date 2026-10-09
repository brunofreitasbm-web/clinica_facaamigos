import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markInbound, INBOUND_MAX_ATTEMPTS } from "@/lib/twilio-inbound-queue";
import { processInboundTwilioMessage, type InboundTwilioPayload } from "@/lib/twilio-inbound";

export const maxDuration = 60;

// Mensagens mais velhas que isso não recebem resposta automática atrasada: fora
// da janela de 24h do WhatsApp o envio de texto livre falharia de qualquer jeito.
const MAX_AGE_MS = 20 * 60 * 60 * 1000;
// Dá tempo do webhook em curso terminar antes de o cron pegar a mesma linha.
const MIN_AGE_MS = 60 * 1000;
const BATCH = 10;

/**
 * Reprocessa a fila de mensagens recebidas (twilio_inbound_queue): linhas
 * 'pending' que o webhook não conseguiu concluir ou que a função de fallback
 * (supabase/functions/twilio-inbound-fallback) gravou enquanto o app estava fora.
 * Chamado pelo pg_cron a cada minuto (mesmo padrão de /api/twilio/absence/trigger).
 */
export async function POST(req: NextRequest) {
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const now = Date.now();
  const { data: rows, error } = await db
    .from("twilio_inbound_queue")
    .select("message_sid, payload, received_at")
    .eq("status", "pending")
    .lt("attempts", INBOUND_MAX_ATTEMPTS)
    .lt("received_at", new Date(now - MIN_AGE_MS).toISOString())
    .order("received_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error("[Twilio Inbound Retry] consulta falhou:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let done = 0;
  let failed = 0;
  let expired = 0;
  for (const row of (rows ?? []) as { message_sid: string; payload: InboundTwilioPayload; received_at: string }[]) {
    if (now - new Date(row.received_at).getTime() > MAX_AGE_MS) {
      await db
        .from("twilio_inbound_queue")
        .update({ status: "failed", last_error: "expirada: fora da janela de resposta" })
        .eq("message_sid", row.message_sid);
      expired += 1;
      continue;
    }
    try {
      await processInboundTwilioMessage(row.payload);
      await markInbound(row.message_sid, "done");
      done += 1;
    } catch (err) {
      console.error("[Twilio Inbound Retry] falhou:", row.message_sid, err);
      await markInbound(row.message_sid, "pending", err);
      failed += 1;
    }
  }
  return NextResponse.json({ done, failed, expired });
}
