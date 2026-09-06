export type ScoreDistribution = { score: number; count: number };

export function NpsMetricsCards({
  avgScore,
  responseCount,
  distribution,
  combinedScore10,
  combinedResponseCount,
}: {
  avgScore: number | null;
  responseCount: number;
  distribution: ScoreDistribution[];
  combinedScore10?: number | null;
  combinedResponseCount?: number;
}) {
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

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
        <span className="card-kicker">Nota média Twilio (1-5)</span>
        <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
          {avgScore ?? "—"}
        </span>
      </div>

      <div className="card min-w-[180px]">
        <span className="card-kicker">Respostas Twilio no mês</span>
        <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
          {responseCount}
        </span>
      </div>

      <div className="card min-w-[320px] flex-1">
        <span className="card-kicker">Distribuição das notas</span>
        <div className="flex items-end gap-3 pt-2">
          {distribution.map((d) => (
            <div key={d.score} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold text-ink-soft">{d.count}</span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(4, (d.count / maxCount) * 80)}px`,
                  background: d.score <= 3 ? "var(--color-status-negative, #d92d20)" : "var(--color-accent)",
                }}
              />
              <span className="text-xs font-semibold text-ink-faint">{d.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
