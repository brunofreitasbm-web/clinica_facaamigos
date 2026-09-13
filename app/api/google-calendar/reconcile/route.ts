import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rede de segurança pro sync do Google Calendar (supabase/functions/
 * sync-google-calendar): reprocessa atendimentos futuros que ficaram
 * 'pending'/'failed' — cobre o caso do Database Webhook não ter disparado
 * (função fora do ar, webhook mal configurado etc.). Chamado pelo pg_cron
 * configurado em supabase/migrations/20260913250000_google_calendar_sync_reconcile_cron.sql
 * (mesmo padrão de /api/twilio/absence/trigger).
 */
export async function POST(req: NextRequest) {
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const functionUrl = process.env.SUPABASE_URL
    ? `${process.env.SUPABASE_URL}/functions/v1/sync-google-calendar`
    : null;
  const webhookSecret = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;

  if (!functionUrl || !webhookSecret) {
    console.error("[Google Calendar Reconcile] SUPABASE_URL ou GOOGLE_CALENDAR_WEBHOOK_SECRET ausente.");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // `appointments` não tem updated_at, então não há como filtrar por
  // "há pelo menos N minutos parado" — na pior hipótese um atendimento cujo
  // webhook está em voo agora é reprocessado também aqui; o handler da
  // função é idempotente (PATCH usando google_event_id), então isso apenas
  // gera um PATCH redundante, não um convite duplicado.
  const { data: pending, error } = await db
    .from("appointments")
    .select("id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, modality, status, google_event_id")
    .in("google_calendar_sync_status", ["pending", "failed"])
    .gt("starts_at", new Date().toISOString());

  if (error) {
    console.error("[Google Calendar Reconcile] Falha ao buscar pendências:", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let synced = 0;
  let failed = 0;

  for (const record of (pending as Record<string, unknown>[]) ?? []) {
    try {
      const resp = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Secret": webhookSecret },
        body: JSON.stringify({ type: "UPDATE", table: "appointments", record }),
      });
      if (resp.ok) synced += 1;
      else failed += 1;
    } catch (err) {
      console.error("[Google Calendar Reconcile] Falha ao reinvocar a função:", err);
      failed += 1;
    }
  }

  return NextResponse.json({ synced, failed });
}
