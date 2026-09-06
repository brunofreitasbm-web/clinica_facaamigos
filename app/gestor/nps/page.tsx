import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { currentMonthRange } from "../data";
import { NpsMetricsCards, type ScoreDistribution } from "./nps-metrics-cards";
import { NpsAlertsPanel, type NpsAlertRow } from "./nps-alerts-panel";

export const dynamic = "force-dynamic";

export default async function NpsPage() {
  const supabase = await createClient();
  const { startISO, endISO } = currentMonthRange();

  const [{ data: monthSurveys }, { data: alertsRaw }] = await Promise.all([
    supabase
      .from("nps_surveys")
      .select("score, responded_at")
      .gte("dispatched_at", startISO)
      .lt("dispatched_at", endISO)
      .not("responded_at", "is", null),
    supabase
      .from("nps_surveys")
      .select(
        "id, score, feedback_text, alert_status, dispatched_at, responded_at, patients(full_name), guardians(full_name)",
      )
      .in("alert_status", ["pending_contact", "em_atendimento"])
      .order("responded_at", { ascending: false }),
  ]);

  const scores = (monthSurveys ?? []).map((s) => s.score).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10 : null;

  const distribution: ScoreDistribution[] = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: scores.filter((s) => s === score).length,
  }));

  const alerts: NpsAlertRow[] = (alertsRaw ?? []).map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const guardian = Array.isArray(a.guardians) ? a.guardians[0] : a.guardians;
    return {
      id: a.id,
      patientName: patient?.full_name ?? "Paciente",
      guardianName: guardian?.full_name ?? null,
      score: a.score,
      feedbackText: a.feedback_text,
      alertStatus: a.alert_status as NpsAlertRow["alertStatus"],
      dateLabel: a.responded_at
        ? new Date(a.responded_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })
        : new Date(a.dispatched_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
    };
  });

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <GestorNav active="nps" pendingNpsAlerts={alerts.filter((a) => a.alertStatus === "pending_contact").length} />

      <div className="flex flex-col gap-8 px-10 py-9">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)" }} className="text-2xl font-bold text-ink">
            NPS · Pesquisa de Satisfação
          </h1>
          <p className="text-sm text-ink-soft">
            Pesquisas disparadas 1h após reavaliações e reuniões de devolutiva com a supervisão.
          </p>
        </div>

        <NpsMetricsCards avgScore={avgScore} responseCount={scores.length} distribution={distribution} />

        <NpsAlertsPanel alerts={alerts} />
      </div>
    </main>
  );
}
