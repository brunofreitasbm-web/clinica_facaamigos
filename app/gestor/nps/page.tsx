import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { currentMonthRange } from "../data";
import { NpsMetricsCards, type ScoreDistribution } from "./nps-metrics-cards";
import { NpsAlertsPanel, type NpsAlertRow } from "./nps-alerts-panel";
import { FamilyFeedbackPanel, type FamilyFeedbackRow } from "./family-feedback-panel";
import { normalizeFeedbackToNps10, normalizeTwilioScoreToNps10 } from "@/lib/family-feedback";

export const dynamic = "force-dynamic";

export default async function NpsPage() {
  const supabase = await createClient();
  const { startISO, endISO } = currentMonthRange();

  const [{ data: monthSurveys }, { data: alertsRaw }, { data: monthFamilyFeedback }, { data: familyFeedbackRaw }] =
    await Promise.all([
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
      // Portal "Avalie" (family_feedback) — sem periodicidade, entram na
      // média combinada do mês igual às respostas do Twilio.
      supabase
        .from("family_feedback")
        .select("category_ratings, created_at")
        .gte("created_at", startISO)
        .lt("created_at", endISO),
      supabase
        .from("family_feedback")
        .select("id, category_ratings, comments, created_at, patients(full_name), guardians(full_name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const scores = (monthSurveys ?? []).map((s) => s.score).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10 : null;

  const distribution: ScoreDistribution[] = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: scores.filter((s) => s === score).length,
  }));

  // Concilia as duas fontes numa escala comum 0-10 pra um painel único
  // (nps_surveys é 1-5, family_feedback é 4 categorias ruim..ótimo).
  const normalizedFamily = (monthFamilyFeedback ?? [])
    .map((f) => normalizeFeedbackToNps10(f.category_ratings as Record<string, string>))
    .filter((n): n is number => n != null);
  const normalizedTwilio = scores.map(normalizeTwilioScoreToNps10);
  const combinedAll = [...normalizedTwilio, ...normalizedFamily];
  const combinedScore10 =
    combinedAll.length > 0 ? Math.round((combinedAll.reduce((sum, n) => sum + n, 0) / combinedAll.length) * 10) / 10 : null;

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

  const familyFeedback: FamilyFeedbackRow[] = (familyFeedbackRaw ?? []).map((f) => {
    const patient = Array.isArray(f.patients) ? f.patients[0] : f.patients;
    const guardian = Array.isArray(f.guardians) ? f.guardians[0] : f.guardians;
    return {
      id: f.id,
      patientName: patient?.full_name ?? "Paciente",
      guardianName: guardian?.full_name ?? null,
      categoryRatings: (f.category_ratings ?? {}) as Record<string, string>,
      comments: f.comments,
      dateLabel: new Date(f.created_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
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
            Pesquisas disparadas 1h após reavaliações e reuniões de devolutiva com a supervisão, combinadas com as
            avaliações enviadas pela família no portal (&quot;Avalie&quot;).
          </p>
        </div>

        <NpsMetricsCards
          avgScore={avgScore}
          responseCount={scores.length}
          distribution={distribution}
          combinedScore10={combinedScore10}
          combinedResponseCount={combinedAll.length}
        />

        <NpsAlertsPanel alerts={alerts} />

        <FamilyFeedbackPanel items={familyFeedback} />
      </div>
    </main>
  );
}
