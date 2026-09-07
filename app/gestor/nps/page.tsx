import Link from "next/link";
import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { currentMonthRange } from "../data";
import { NpsMetricsCards, type ScoreDistribution } from "./nps-metrics-cards";
import { FamilyFeedbackPanel, type FamilyFeedbackRow } from "./family-feedback-panel";
import { normalizeFeedbackToNps10, normalizeTwilioScoreToNps10 } from "@/lib/family-feedback";

export const dynamic = "force-dynamic";

export default async function NpsPage() {
  const supabase = await createClient();
  const { startISO, endISO } = currentMonthRange();

  const [{ data: monthSurveys }, { data: monthlySurveys }, { count: pendingAlertsCount }, { data: monthFamilyFeedback }, { data: familyFeedbackRaw }] =
    await Promise.all([
      // Disparos por evento (avaliação/devolutiva), escala 1-5.
      supabase
        .from("nps_surveys")
        .select("score, responded_at")
        .in("trigger_type", ["evaluation", "devolutiva"])
        .gte("dispatched_at", startISO)
        .lt("dispatched_at", endISO)
        .not("responded_at", "is", null),
      // Disparo mensal (todo paciente ativo), escala 0-10 — já comparável
      // direto com o combinado, sem normalização.
      supabase
        .from("nps_surveys")
        .select("score, responded_at")
        .eq("trigger_type", "mensal")
        .gte("dispatched_at", startISO)
        .lt("dispatched_at", endISO)
        .not("responded_at", "is", null),
      // A triagem de detrator (contatar/resolver) é atendimento à família —
      // fica na caixa de entrada da Supervisão. Aqui só o contador.
      supabase
        .from("nps_surveys")
        .select("id", { count: "exact", head: true })
        .in("alert_status", ["pending_contact", "em_atendimento"]),
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

  const monthlyScores = (monthlySurveys ?? []).map((s) => s.score).filter((s): s is number => s != null);
  const monthlyAvgScore =
    monthlyScores.length > 0
      ? Math.round((monthlyScores.reduce((sum, s) => sum + s, 0) / monthlyScores.length) * 10) / 10
      : null;

  // Concilia as três fontes numa escala comum 0-10 pra um painel único
  // (nps_surveys por evento é 1-5, disparo mensal já é 0-10, family_feedback
  // é 4 categorias ruim..ótimo).
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

      <div className="flex flex-col gap-8 px-10 py-9">
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)" }} className="text-2xl font-bold text-ink">
            NPS · Pesquisa de Satisfação
          </h1>
          <p className="text-sm text-ink-soft">
            Pesquisas disparadas 1h após reavaliações e reuniões de devolutiva com a supervisão, o disparo mensal
            (0-10) para todo paciente ativo, e as avaliações enviadas pela família no portal (&quot;Avalie&quot;).
          </p>
        </div>

        <NpsMetricsCards
          avgScore={avgScore}
          responseCount={scores.length}
          distribution={distribution}
          combinedScore10={combinedScore10}
          combinedResponseCount={combinedAll.length}
          monthlyAvgScore={monthlyAvgScore}
          monthlyResponseCount={monthlyScores.length}
        />

        {(pendingAlertsCount ?? 0) > 0 && (
          <Link
            href="/supervisao"
            className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm no-underline"
          >
            <span className="font-semibold text-red-800">
              {pendingAlertsCount} alerta(s) de insatisfação aguardando contato
            </span>
            <span className="text-xs font-medium text-red-700">Triagem e resolução ficam na Supervisão →</span>
          </Link>
        )}

        <FamilyFeedbackPanel items={familyFeedback} />
      </div>
    </main>
  );
}
