// Gráficos SVG inline dos instrumentos de fono, no mesmo estilo de
// DomainTrendChart em components/protocol-assessment-panel.tsx:15-53 (sem
// biblioteca externa — o projeto não tem nenhuma de gráficos).

export function GroupedBarChart({
  bars,
  maxValue,
}: {
  bars: { label: string; a: number; b: number }[];
  maxValue: number;
}) {
  const width = Math.max(320, bars.length * 56);
  const height = 140;
  const padding = 24;
  const barGroupWidth = (width - padding * 2) / bars.length;
  const barWidth = Math.min(16, barGroupWidth / 3);
  const scale = (v: number) => (maxValue === 0 ? 0 : (v / maxValue) * (height - padding * 2));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Gráfico de acertos por faixa etária">
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="var(--color-paper-line-strong)" strokeWidth={1} />
      {bars.map((bar, i) => {
        const groupX = padding + i * barGroupWidth + barGroupWidth / 2;
        const ha = scale(bar.a);
        const hb = scale(bar.b);
        return (
          <g key={bar.label}>
            <rect x={groupX - barWidth - 2} y={height - padding - ha} width={barWidth} height={ha} fill="var(--color-chart)">
              <title>
                {bar.label}: {bar.a}
              </title>
            </rect>
            <rect x={groupX + 2} y={height - padding - hb} width={barWidth} height={hb} fill="var(--color-accent-2)">
              <title>
                {bar.label}: {bar.b}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

export function MaxAchievedBarChart({ bars }: { bars: { label: string; max: number; achieved: number }[] }) {
  const width = Math.max(280, bars.length * 90);
  const height = 120;
  const padding = 24;
  const groupWidth = (width - padding * 2) / bars.length;
  const barWidth = Math.min(28, groupWidth * 0.5);
  const maxOfAll = Math.max(1, ...bars.map((b) => b.max));
  const scale = (v: number) => (v / maxOfAll) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Gráfico de pontuação máxima x alcançada">
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="var(--color-paper-line-strong)" strokeWidth={1} />
      {bars.map((bar, i) => {
        const x = padding + i * groupWidth + groupWidth / 2 - barWidth / 2;
        const hMax = scale(bar.max);
        const hAchieved = scale(bar.achieved);
        return (
          <g key={bar.label}>
            <rect x={x} y={height - padding - hMax} width={barWidth} height={hMax} fill="var(--color-paper-line-strong)">
              <title>
                {bar.label} — máximo {bar.max}
              </title>
            </rect>
            <rect x={x} y={height - padding - hAchieved} width={barWidth} height={hAchieved} fill="var(--color-accent)">
              <title>
                {bar.label} — alcançado {bar.achieved}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
