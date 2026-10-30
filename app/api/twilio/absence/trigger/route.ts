import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, getWhatsAppTemplateForCategory } from "@/lib/whatsapp";
import { CLINIC_TIMEZONE } from "@/lib/constants";

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
        .select("id, full_name, phone, is_financial")
        .eq("patient_id", alert.patient_id);

      const guardian = ((guardians as any[]) ?? []).find((g) => g.is_financial) ?? ((guardians as any[]) ?? [])[0];
      if (!guardian) {
        failed += 1;
        continue;
      }

      if (!guardian.phone) {
        failed += 1;
        continue;
      }

      // Nomes e data reais no template (antes iam "Responsável"/"Paciente"/"hoje"/"horário agendado"):
      // a falta mais recente da criança dá a data e a hora.
      const [{ data: patient }, { data: lastAbsence }] = await Promise.all([
        db.from("patients").select("full_name").eq("id", alert.patient_id).maybeSingle(),
        db
          .from("appointments")
          .select("starts_at")
          .eq("patient_id", alert.patient_id)
          .eq("status", "falta_familia")
          .order("starts_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const firstName = (full: string | null | undefined, fallback: string) => (full ?? "").trim().split(/\s+/)[0] || fallback;
      const guardianName = firstName(guardian.full_name, "responsável");
      const childName = firstName(patient?.full_name, "seu(sua) filho(a)");
      const absenceAt = lastAbsence?.starts_at ? new Date(lastAbsence.starts_at as string) : null;
      const absenceDay = absenceAt
        ? absenceAt.toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE, day: "2-digit", month: "2-digit" })
        : "recentemente";
      const absenceTime = absenceAt
        ? absenceAt.toLocaleTimeString("pt-BR", { timeZone: CLINIC_TIMEZONE, hour: "2-digit", minute: "2-digit" })
        : "horário agendado";

      const message =
        `Notamos ${alert.consecutive_faltas} falta(s) recente(s). ` +
        "Se está difícil manter os horários, responda esta mensagem — a gente ajuda a reorganizar a agenda.";

      const contentSid = getWhatsAppTemplateForCategory("falta");
      const result = await sendWhatsApp({
        to: guardian.phone,
        message,
        ...(contentSid
          ? {
              contentSid,
              contentVariables: {
                "1": guardianName,
                "2": childName,
                "3": absenceDay,
                "4": absenceTime,
                "5": "Recepção",
              },
            }
          : {}),
      });

      await db.from("messages").insert({
        patient_id: alert.patient_id,
        guardian_id: guardian.id,
        sender_type: "system",
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
