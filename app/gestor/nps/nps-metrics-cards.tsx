export type ScoreDistribution = { score: number; count: number };

export function NpsMetricsCards({
  avgScore,
  responseCount,
  distribution,
  combinedScore10,
  combinedResponseCount,
  monthlyAvgScore,
  monthlyResponseCount,
}: {
  avgScore: number | null;
  responseCount: number;
  distribution: ScoreDistribution[];
  combinedScore10?: number | null;
  combinedResponseCount?: number;
  monthlyAvgScore?: number | null;
  monthlyResponseCount?: number;
}) {
  const totalCount = distribution.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));
  const hasData = totalCount > 0;

  return (
    <div className="flex flex-wrap gap-6">
      {combinedScore10 !== undefined && (
        <div className="card min-w-[220px]">
          <span className="card-kicker">Satisfação geral (combinada, 0-10)</span>
          <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
            {combinedScore10 ?? "—"}
          </span>
          <span className="text-xs text-ink-faint">
            {combinedResponseCount ?? 0} respostas · Twilio + Avalie (família)
          </span>
        </div>
      )}

      <div className="card min-w-[180px]">
        <span className="card-kicker">Satisfação Twilio (CSAT 1-5)</span>
        <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
          {avgScore ? `${avgScore} ★` : "—"}
        </span>
      </div>

      <div className="card min-w-[180px]">
        <span className="card-kicker">Respostas Twilio no mês</span>
        <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
          {responseCount}
        </span>
      </div>

      {monthlyAvgScore !== undefined && (
        <div className="card min-w-[180px]">
          <span className="card-kicker">NPS mensal (0-10)</span>
          <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
            {monthlyAvgScore ?? "—"}
          </span>
          <span className="text-xs text-ink-faint">{monthlyResponseCount ?? 0} respostas no mês</span>
        </div>
      )}

      <div className="card min-w-[320px] flex-1">
        <span className="card-kicker">Distribuição das notas (CSAT)</span>
        {!hasData ? (
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-end gap-3 h-20 opacity-50">
              {[1, 2, 3, 4, 5].map((score) => (
                <div key={score} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full h-8 rounded-t bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs font-semibold text-slate-400">{score} ★</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-ink-faint italic text-center">Volume de dados insuficiente para o gráfico</span>
          </div>
        ) : (
          <div className="flex items-end gap-3 pt-2">
            {distribution.map((d) => (
              <div key={d.score} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold text-ink-soft">{d.count}</span>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(6, (d.count / maxCount) * 80)}px`,
                    background:
                      d.score <= 2
                        ? "#F43F5E"
                        : d.score === 3
                        ? "#FB7185"
                        : "var(--color-accent, #E11D48)",
                  }}
                />
                <span className="text-xs font-semibold text-ink-faint">{d.score} ★</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
