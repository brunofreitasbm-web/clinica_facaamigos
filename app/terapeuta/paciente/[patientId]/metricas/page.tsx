import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getPatientProgramTrends, getPatientGoalCountsByDomain } from "@/lib/patient-metrics";
import { logRecordAccess } from "@/lib/record-access-log";

export const dynamic = "force-dynamic";

const DOMAIN_LABEL: Record<string, string> = {
  motor: "Motor",
  fala: "Fala",
  comunicacao: "Comunicação",
  social: "Social",
  autonomia: "Autonomia",
  cognitivo: "Cognitivo",
  comportamento: "Comportamento",
  outro: "Outro",
};

function domainLabel(domain: string): string {
  return DOMAIN_LABEL[domain] ?? domain.charAt(0).toUpperCase() + domain.slice(1);
}

function Sparkline({ weeks }: { weeks: { weekStart: string; pctCorrect: number | null; trials: number }[] }) {
  const width = 280;
  const height = 60;
  const padding = 4;
  const withValue = weeks.filter((w) => w.pctCorrect !== null);
  if (withValue.length === 0) {
    return <p className="text-xs text-ink-faint">Sem dados suficientes.</p>;
  }

  const points = withValue.map((w, i) => {
    const x = withValue.length === 1 ? width / 2 : padding + (i / (withValue.length - 1)) * (width - padding * 2);
    const y = height - padding - ((w.pctCorrect as number) / 100) * (height - padding * 2);
    return { x, y, w };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Evolução semanal">
      <line
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        stroke="var(--color-paper-line-strong)"
        strokeWidth={1}
      />
      <path d={path} fill="none" stroke="var(--color-chart)" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-chart)">
          <title>
            {p.w.weekStart} · {p.w.pctCorrect}% correto ({p.w.trials} tentativas)
          </title>
        </circle>
      ))}
    </svg>
  );
}

export default async function PatientMetricsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "metricas_aba");

  const [{ trends, domainAverages }, goalCounts] = await Promise.all([
    getPatientProgramTrends(supabase, patientId),
    getPatientGoalCountsByDomain(supabase, patientId),
  ]);

  const maxDomainPct = Math.max(...domainAverages.map((d) => d.pctCorrect), 1);
  const maxGoalTotal = Math.max(...goalCounts.map((d) => d.ativa + d.atingida + d.suspensa), 1);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Evolução — ${patient.full_name}`}
        description="Progresso por programa (coleta ABA) e por domínio — motor, fala, social, autonomia."
      />
      <div className="flex flex-col gap-8 p-6 sm:p-10">
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Evolução semanal por programa
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {trends.map((t) => (
              <div key={t.programId} className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
                <p className="text-sm font-medium text-ink">{t.programName}</p>
                <p className="text-xs text-ink-faint">% de acertos por semana</p>
                <div className="mt-2">
                  <Sparkline weeks={t.weeks} />
                </div>
              </div>
            ))}
            {trends.length === 0 && (
              <p className="text-sm text-ink-faint">
                Nenhuma coleta de tentativas (ABA) registrada ainda para este paciente.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Desempenho por domínio · últimos 60 dias
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {domainAverages.map((d) => (
              <div key={d.domain} className="grid grid-cols-[120px_1fr_60px] items-center gap-3 text-sm">
                <span className="truncate">{domainLabel(d.domain)}</span>
                <span
                  className="block"
                  style={{ background: "var(--color-paper-line-strong)", borderRadius: 4, height: 10 }}
                  title={`${d.trials} tentativas`}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${Math.max(4, (d.pctCorrect / maxDomainPct) * 100)}%`,
                      background: "var(--color-chart)",
                      borderRadius: 4,
                    }}
                  />
                </span>
                <span className="tabular-figure text-right">{d.pctCorrect}%</span>
              </div>
            ))}
            {domainAverages.length === 0 && (
              <p className="text-sm text-ink-faint">Sem tentativas registradas nos últimos 60 dias.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Metas do plano aprovado, por domínio
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {goalCounts.map((d) => {
              return (
                <div key={d.domain} className="grid grid-cols-[120px_1fr_140px] items-center gap-3 text-sm">
                  <span className="truncate">{domainLabel(d.domain)}</span>
                  <span
                    className="flex overflow-hidden"
                    style={{ background: "var(--color-paper-line-strong)", borderRadius: 4, height: 10 }}
                  >
                    <span
                      title={`${d.atingida} atingidas`}
                      style={{ width: `${(d.atingida / maxGoalTotal) * 100}%`, background: "var(--status-realizada)" }}
                    />
                    <span
                      title={`${d.ativa} ativas`}
                      style={{ width: `${(d.ativa / maxGoalTotal) * 100}%`, background: "var(--status-em-atendimento)" }}
                    />
                    <span
                      title={`${d.suspensa} suspensas`}
                      style={{ width: `${(d.suspensa / maxGoalTotal) * 100}%`, background: "var(--status-cancelada)" }}
                    />
                  </span>
                  <span className="text-xs text-ink-faint">
                    {d.atingida} atingidas · {d.ativa} ativas · {d.suspensa} suspensas
                  </span>
                </div>
              );
            })}
            {goalCounts.length === 0 && (
              <p className="text-sm text-ink-faint">Nenhum plano terapêutico com metas cadastradas ainda.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
