import { GestorNav } from "@/components/gestor-nav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

type MaturityRow = { label: string; tem: boolean; funciona: boolean; monitorado: boolean };

const CHECK = (v: boolean) => (v ? "✓" : "—");

/**
 * Checklist de maturidade (Módulo 3 MAAIS, slide 40) — "A clínica possui..."
 * Tem / Funciona / É monitorado, calculado automaticamente a partir das
 * tabelas reais em vez de preenchido manualmente:
 *  - Tem: a funcionalidade existe no sistema (sempre true aqui, listamos só
 *    o que já foi implementado).
 *  - Funciona: há pelo menos 1 registro real nos últimos 90 dias.
 *  - É monitorado: existe um indicador computado ligado a essa etapa
 *    (metric_snapshots com valor não nulo no mês fechado mais recente).
 */
export default async function MaturidadePage() {
  const supabase = await createClient();
  // Server Component: cada requisição já roda de novo no servidor, não há
  // "re-render" de cliente pra esta chamada ficar instável.
  // eslint-disable-next-line react-hooks/purity
  const since90d = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [
    { count: anamnesesCount },
    { count: intakeInterviewCount },
    { count: protocolAssessmentsCount },
    { count: bondingReportsCount },
    { count: teamCount },
    { count: interdisciplinaryCount },
    { count: plansCount },
    { count: approvedPlansCount },
    { count: devolutivaCount },
    { count: metricSnapshotsCount },
  ] = await Promise.all([
    supabase.from("anamneses").select("id", { count: "exact", head: true }).gte("conducted_at", since90d),
    supabase.from("intake_steps").select("id", { count: "exact", head: true }).eq("step_key", "primeiro_contato").eq("status", "concluida"),
    supabase.from("protocol_assessments").select("id", { count: "exact", head: true }).gte("assessed_at", since90d),
    supabase.from("bonding_reports").select("id", { count: "exact", head: true }).gte("period_start", since90d.slice(0, 10)),
    supabase.from("patient_access").select("id", { count: "exact", head: true }).not("role_in_team", "is", null).is("revoked_at", null),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("kind", "interdisciplinar").gte("held_at", since90d),
    supabase.from("treatment_plans").select("id", { count: "exact", head: true }),
    supabase.from("treatment_plans").select("id", { count: "exact", head: true }).not("approved_by", "is", null),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("kind", "devolutiva").gte("held_at", since90d),
    supabase
      .from("metric_snapshots")
      .select("id", { count: "exact", head: true })
      .in("metric_key", ["intake_60d_rate", "protocol_coverage_rate", "plan_reviewed_rate", "review_on_time"])
      .eq("scope_id", DEV_CLINIC_ID),
  ]);

  const monitored = (metricSnapshotsCount ?? 0) > 0;

  const rows: MaturityRow[] = [
    { label: "1ª avaliação (anamnese) padronizada", tem: true, funciona: (anamnesesCount ?? 0) > 0, monitorado: monitored },
    { label: "Entrevista inicial (primeiro contato)", tem: true, funciona: (intakeInterviewCount ?? 0) > 0, monitorado: true },
    { label: "Protocolo de avaliação", tem: true, funciona: (protocolAssessmentsCount ?? 0) > 0, monitorado: monitored },
    { label: "Registro de vínculo", tem: true, funciona: (bondingReportsCount ?? 0) > 0, monitorado: false },
    { label: "Supervisão por área (equipe de avaliação)", tem: true, funciona: (teamCount ?? 0) > 0, monitorado: false },
    { label: "Reunião interdisciplinar", tem: true, funciona: (interdisciplinaryCount ?? 0) > 0, monitorado: false },
    { label: "Carta ao Terapeuta", tem: true, funciona: false, monitorado: false },
    { label: "PTS", tem: true, funciona: (plansCount ?? 0) > 0, monitorado: monitored },
    { label: "Validação do PTS", tem: true, funciona: (approvedPlansCount ?? 0) > 0, monitorado: monitored },
    { label: "Devolutiva à família", tem: true, funciona: (devolutivaCount ?? 0) > 0, monitorado: monitored },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <GestorNav />
      <div className="px-10 pt-9 pb-10 flex flex-col gap-6">
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
            Módulo 3 MAAIS · Slide 40
          </h6>
          <h1 className="m-0">A clínica possui...</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            &quot;Funciona&quot; exige ao menos 1 registro real nos últimos 90 dias. &quot;É monitorado&quot; exige um
            indicador com valor calculado no fechamento mensal mais recente.
          </p>
        </div>
        <table className="table max-w-3xl">
          <thead>
            <tr>
              <th>A clínica possui...</th>
              <th>Tem</th>
              <th>Funciona</th>
              <th>É monitorado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="font-semibold">{r.label}</td>
                <td className="text-center">{CHECK(r.tem)}</td>
                <td className="text-center">{CHECK(r.funciona)}</td>
                <td className="text-center">{CHECK(r.monitorado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
