import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentMonthlyNpsPeriod } from "@/lib/survey-period";

/**
 * Libera a pesquisa mensal de NPS (0-10) no portal da família para todo
 * paciente ativo, chamado uma vez por mês pelo pg_cron configurado em
 * supabase/migrations/20260907000000_nps_mensal.sql. Reaproveita
 * nps_surveys (trigger_type='mensal'), diferente dos disparos por evento
 * de app/api/twilio/nps/trigger — dedup por (patient_id, period) garante
 * no máximo um disparo por paciente por mês mesmo que a rota seja chamada
 * mais de uma vez no mesmo período.
 *
 * NPS Externo não é mais enviado via Twilio/WhatsApp: esta rota só cria o
 * registro pendente em nps_surveys, respondido pelo responsável no portal
 * da família (app/familia) via submit_nps_response
 * (supabase/migrations/20260908030000_nps_externo_portal_only.sql).
 */
export async function POST(req: NextRequest) {
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const period = currentMonthlyNpsPeriod();

  let dispatched = 0;

  try {
    const { data: patients } = await admin.from("patients").select("id").eq("status", "ativo");

    const patientIds = (patients ?? []).map((p) => p.id);
    if (patientIds.length === 0) {
      return NextResponse.json({ dispatched });
    }

    const { data: alreadyDispatched } = await (admin as any)
      .from("nps_surveys")
      .select("patient_id")
      .eq("trigger_type", "mensal")
      .eq("period", period)
      .in("patient_id", patientIds);

    const alreadyDispatchedIds = new Set((alreadyDispatched ?? []).map((r: any) => r.patient_id));
    const eligiblePatientIds = patientIds.filter((id) => !alreadyDispatchedIds.has(id));

    for (const patientId of eligiblePatientIds) {
      const { data: guardians } = await admin
        .from("guardians")
        .select("id, phone, is_financial")
        .eq("patient_id", patientId);

      const guardian = (guardians ?? []).find((g) => g.is_financial) ?? (guardians ?? [])[0];
      if (!guardian) continue;

      const { error: insertError } = await (admin as any).from("nps_surveys").insert({
        patient_id: patientId,
        guardian_id: guardian.id,
        phone_number: guardian.phone,
        trigger_type: "mensal",
        period,
      });

      if (!insertError) dispatched += 1;
    }
  } catch (error) {
    console.error("[NPS Mensal Trigger Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ dispatched, period });
}
