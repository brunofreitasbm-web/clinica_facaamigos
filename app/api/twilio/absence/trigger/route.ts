import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTwilioWhatsApp } from "@/lib/twilio";

/**
 * Disparo diário do aviso de faltas (MAAIS §13 / PRD "risco de evasão",
 * linha 390): 3 faltas consecutivas ou >=50% em 3 meses, chamado pelo
 * pg_cron configurado em supabase/migrations/20260906000015_absence_alerts.sql
 * (mesmo padrão de /api/twilio/nps/trigger).
 *
 * refresh_absence_alerts() faz o cálculo em SQL, abre a linha em
 * absence_alerts e já grava o aviso no canal 'portal' de `messages` — aqui
 * só resta achar quem ainda não recebeu o WhatsApp (status='pendente') e
 * mandar via Twilio.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  let sent = 0;
  let failed = 0;

  try {
    const { error: refreshError } = await db.rpc("refresh_absence_alerts");
    if (refreshError) {
      console.error("[Absence Alerts Trigger] refresh_absence_alerts falhou:", refreshError);
      return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
    }

    const { data: pending } = await db
      .from("absence_alerts")
      .select("id, patient_id, consecutive_faltas, faltas_pct_3m")
      .eq("status", "pendente");

    for (const alert of (pending as any[]) ?? []) {
      const { data: guardians } = await db
        .from("guardians")
        .select("id, phone, is_financial")
        .eq("patient_id", alert.patient_id);

      const guardian = ((guardians as any[]) ?? []).find((g) => g.is_financial) ?? ((guardians as any[]) ?? [])[0];
      if (!guardian) {
        failed += 1;
        continue;
      }

      const message =
        `Notamos ${alert.consecutive_faltas} falta(s) recente(s). ` +
        "Se está difícil manter os horários, responda esta mensagem — a gente ajuda a reorganizar a agenda.";

      const result = await sendTwilioWhatsApp({ to: guardian.phone, message });

      await db.from("messages").insert({
        patient_id: alert.patient_id,
        guardian_id: guardian.id,
        channel: "whatsapp",
        direction: "outbound",
        template_key: "aviso_faltas",
        body: message,
        sent_at: result.success ? new Date().toISOString() : null,
        twilio_sid: result.messageId ?? null,
        delivery_status: result.success ? "sent" : "failed",
      });

      if (result.success) {
        await db
          .from("absence_alerts")
          .update({ status: "notificado", notified_at: new Date().toISOString() })
          .eq("id", alert.id);
        sent += 1;
      } else {
        failed += 1;
      }
    }
  } catch (error) {
    console.error("[Absence Alerts Trigger Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ sent, failed });
}
