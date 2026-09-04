/**
 * Dispositivo central do mundo (Gráfico de Crescimento Pediátrico): uma
 * curva/linha de tendência, com faixa de referência opcional. Nesta fase de
 * scaffold, sem dado real de série temporal ainda, a curva é achatada em
 * "sem histórico" — mas o dispositivo existe e é honesto sobre não ter
 * dado, em vez de ficar totalmente ausente da tela.
 */
export function TrendStrip({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-paper-line-strong bg-paper/60 px-5 py-4">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {label}
      </span>
      <svg
        viewBox="0 0 320 64"
        className="mt-3 h-16 w-full text-chart"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* banda de referência — faixa esperada */}
        <rect x="0" y="20" width="320" height="24" fill="var(--color-chart-soft)" />
        {/* linha de tendência achatada — sem histórico real ainda */}
        <polyline
          points="0,32 40,32 80,32 120,32 160,32 200,32 240,32 280,32 320,32"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        {[0, 80, 160, 240, 320].map((x) => (
          <line
            key={x}
            x1={x}
            y1="0"
            x2={x}
            y2="64"
            stroke="var(--color-paper-line-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <p className="mt-1 text-xs text-ink-faint">
        Sem histórico ainda — a curva preenche assim que houver dado real de
        competência anterior.
      </p>
    </div>
  );
}
