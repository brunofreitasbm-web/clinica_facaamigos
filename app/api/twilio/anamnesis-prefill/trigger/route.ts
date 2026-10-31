import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppTemplateForCategory, sendWhatsApp } from "@/lib/whatsapp";
import { buildReminderMessage } from "@/lib/anamnesis-prefill";
import { isWhatsAppWindowOpen } from "@/lib/whatsapp-window";
import { CLINIC_TIMEZONE } from "@/lib/constants";

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
      .select("id, patient_id, appointment_id, guardian_id, phone_number")
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

      // 48h depois do convite a janela de 24h já fechou (a menos que a família tenha escrito): texto
      // livre seria recusado e o pedido ficaria marcado como "lembrete enviado" sem ninguém receber.
      // O lembrete reenvia o template do convite (com os botões); sem ele, só vai com a janela aberta.
      const inviteSid = getWhatsAppTemplateForCategory("convite_pre_anamnese");
      let result: { success: boolean };
      if (inviteSid) {
        const [{ data: guardian }, { data: appointment }] = await Promise.all([
          db.from("guardians").select("full_name").eq("id", request.guardian_id).maybeSingle(),
          db.from("appointments").select("starts_at").eq("id", request.appointment_id).maybeSingle(),
        ]);
        const guardianFirstName = ((guardian?.full_name as string | null) ?? "").trim().split(/\s+/)[0] || "família";
        const formattedDate = appointment?.starts_at
          ? new Date(appointment.starts_at as string).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE, dateStyle: "full", timeStyle: "short" })
          : "a data combinada";
        result = await sendWhatsApp({
          to: request.phone_number,
          message: buildReminderMessage(childName),
          contentSid: inviteSid,
          contentVariables: { "1": guardianFirstName, "2": childName, "3": formattedDate },
        });
      } else if (await isWhatsAppWindowOpen(request.phone_number)) {
        result = await sendWhatsApp({ to: request.phone_number, message: buildReminderMessage(childName) });
      } else {
        failed += 1;
        continue;
      }

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
