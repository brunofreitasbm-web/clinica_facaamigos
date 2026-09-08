import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Libera a pesquisa NPS (1-5) no portal da família 1h após reavaliação
 * (appointments) ou reunião de devolutiva (meetings), chamado a cada ~10min
 * pelo pg_cron configurado em supabase/migrations/20260906000011_nps_surveys.sql.
 * Janela de 1h-2h atrás tolera o intervalo do cron sem perder nem duplicar
 * disparo (a unicidade de nps_surveys.appointment_id/meeting_id evita
 * duplicidade mesmo que a mesma linha seja avaliada em duas execuções).
 *
 * NPS Externo não é mais enviado via Twilio/WhatsApp: esta rota só cria o
 * registro pendente em nps_surveys, que passa a aparecer para o responsável
 * no portal da família (app/familia), onde ele responde via
 * submit_nps_response (supabase/migrations/20260908030000_nps_externo_portal_only.sql).
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now - 60 * 60 * 1000).toISOString();

  let dispatched = 0;

  try {
    const { data: evaluations } = await admin
      .from("appointments")
      .select("id, patient_id, ends_at")
      .eq("is_evaluation", true)
      .eq("status", "realizada")
      .gte("ends_at", windowStart)
      .lte("ends_at", windowEnd);

    const { data: devolutivas } = await admin
      .from("meetings")
      .select("id, patient_id, held_at")
      .eq("kind", "devolutiva")
      .gte("held_at", windowStart)
      .lte("held_at", windowEnd);

    const appointmentIds = (evaluations ?? []).map((a) => a.id);
    const meetingIds = (devolutivas ?? []).map((m) => m.id);

    const [{ data: existingByAppointment }, { data: existingByMeeting }] = await Promise.all([
      appointmentIds.length
        ? admin.from("nps_surveys").select("appointment_id").in("appointment_id", appointmentIds)
        : Promise.resolve({ data: [] as { appointment_id: string | null }[] }),
      meetingIds.length
        ? admin.from("nps_surveys").select("meeting_id").in("meeting_id", meetingIds)
        : Promise.resolve({ data: [] as { meeting_id: string | null }[] }),
    ]);

    const alreadyDispatchedAppointments = new Set((existingByAppointment ?? []).map((r) => r.appointment_id));
    const alreadyDispatchedMeetings = new Set((existingByMeeting ?? []).map((r) => r.meeting_id));

    const eligible: { patientId: string; appointmentId?: string; meetingId?: string; triggerType: "evaluation" | "devolutiva" }[] = [
      ...(evaluations ?? [])
        .filter((a) => !alreadyDispatchedAppointments.has(a.id))
        .map((a) => ({ patientId: a.patient_id, appointmentId: a.id, triggerType: "evaluation" as const })),
      ...(devolutivas ?? [])
        .filter((m) => !alreadyDispatchedMeetings.has(m.id))
        .map((m) => ({ patientId: m.patient_id, meetingId: m.id, triggerType: "devolutiva" as const })),
    ];

    for (const item of eligible) {
      const { data: guardians } = await admin
        .from("guardians")
        .select("id, phone, is_financial")
        .eq("patient_id", item.patientId);

      const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
      if (!guardian) continue;

      const { error: insertError } = await (admin as any).from("nps_surveys").insert({
        appointment_id: item.appointmentId ?? null,
        meeting_id: item.meetingId ?? null,
        trigger_type: item.triggerType,
        patient_id: item.patientId,
        guardian_id: guardian.id,
        phone_number: guardian.phone,
      });

      if (!insertError) dispatched += 1;
    }
  } catch (error) {
    console.error("[NPS Trigger Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ dispatched });
}
