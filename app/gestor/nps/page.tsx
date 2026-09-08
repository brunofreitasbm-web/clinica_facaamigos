import Link from "next/link";
import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { currentMonthRange } from "../data";
import { type ScoreDistribution } from "./nps-metrics-cards";
import { type FamilyFeedbackRow } from "./family-feedback-panel";
import { normalizeFeedbackToNps10, normalizeTwilioScoreToNps10 } from "@/lib/family-feedback";
import { NpsTabbedView } from "./nps-tabbed-view";

export const dynamic = "force-dynamic";

export default async function NpsPage() {
  const supabase = await createClient();
  const { startISO, endISO } = currentMonthRange();

  const [{ data: monthSurveys }, { data: monthlySurveys }, { count: pendingAlertsCount }, { data: monthFamilyFeedback }, { data: familyFeedbackRaw }] =
    await Promise.all([
      supabase
        .from("nps_surveys")
        .select("score, responded_at")
        .in("trigger_type", ["evaluation", "devolutiva"])
        .gte("dispatched_at", startISO)
        .lt("dispatched_at", endISO)
        .not("responded_at", "is", null),
      supabase
        .from("nps_surveys")
        .select("score, responded_at")
        .eq("trigger_type", "mensal")
        .gte("dispatched_at", startISO)
        .lt("dispatched_at", endISO)
        .not("responded_at", "is", null),
      supabase
        .from("nps_surveys")
        .select("id", { count: "exact", head: true })
        .in("alert_status", ["pending_contact", "em_atendimento"]),
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

  const monthlyScores = (monthlySurveys ?? []).map((s) => s.score).filter((s): s is number => s != null);
  const monthlyAvgScore =
    monthlyScores.length > 0
      ? Math.round((monthlyScores.reduce((sum, s) => sum + s, 0) / monthlyScores.length) * 10) / 10
      : null;

  const normalizedFamily = (monthFamilyFeedback ?? [])
    .map((f) => normalizeFeedbackToNps10(f.category_ratings as Record<string, string>))
    .filter((n): n is number => n != null);
  const normalizedTwilio = scores.map(normalizeTwilioScoreToNps10);
  const combinedAll = [...normalizedTwilio, ...monthlyScores, ...normalizedFamily];
  const combinedScore10 =
    combinedAll.length > 0 ? Math.round((combinedAll.reduce((sum, n) => sum + n, 0) / combinedAll.length) * 10) / 10 : null;

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
      <GestorNav active="nps" pendingNpsAlerts={pendingAlertsCount ?? 0} />

      <div className="flex flex-col gap-6 px-10 py-9">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)" }} className="text-2xl font-bold text-ink">
            NPS · Pesquisas de Satisfação
          </h1>
          <p className="text-sm text-ink-soft">
            Gestão centralizada de pesquisas de satisfação: acompanhe o NPS Externo (Pacientes & Famílias) e o NPS Interno (Equipe Multidisciplinar).
          </p>
        </div>

        <NpsTabbedView
          avgScore={avgScore}
          responseCount={scores.length}
          distribution={distribution}
          combinedScore10={combinedScore10}
          combinedResponseCount={combinedAll.length}
          monthlyAvgScore={monthlyAvgScore}
          monthlyResponseCount={monthlyScores.length}
          pendingAlertsCount={pendingAlertsCount ?? 0}
          familyFeedback={familyFeedback}
        />
      </div>
    </main>
  );
}
