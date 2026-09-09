import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTwilioWhatsApp } from "@/lib/twilio";
import { buildReminderMessage } from "@/lib/anamnesis-prefill";

/**
 * Lembrete de anamnese pré-consulta, disparado a cada 30min pelo pg_cron
 * configurado em supabase/migrations/20260906000017_anamnesis_prefill_requests.sql
 * (mesmo padrão de /api/twilio/nps/trigger e /api/twilio/absence/trigger).
 *
 * Reforça só quem ainda está em status='enviado' (nunca respondeu nem
 * recusou) há mais de 48h desde o convite inicial — `reminder_sent_at is
 * null` garante que cada pedido recebe no máximo um lembrete.
 */
export async function POST(req: NextRequest) {
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  let sent = 0;
  let failed = 0;

  try {
    const cutoffISO = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: pending } = await db
      .from("anamnesis_prefill_requests")
      .select("id, patient_id, phone_number")
      .eq("status", "enviado")
      .is("reminder_sent_at", null)
      .lte("sent_at", cutoffISO);

    for (const request of (pending as any[]) ?? []) {
      const { data: patient } = await db
        .from("patients")
        .select("full_name")
        .eq("id", request.patient_id)
        .maybeSingle();

      const childName = patient?.full_name ?? "seu(sua) filho(a)";
      const result = await sendTwilioWhatsApp({
        to: request.phone_number,
        message: buildReminderMessage(childName),
      });

      if (result.success) {
        await db
          .from("anamnesis_prefill_requests")
          .update({ status: "lembrete_enviado", reminder_sent_at: new Date().toISOString() })
          .eq("id", request.id);
        sent += 1;
      } else {
        failed += 1;
      }
    }
  } catch (error) {
    console.error("[Anamnesis Prefill Reminder Trigger Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ sent, failed });
}
