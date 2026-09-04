export function PageHeader({
  axisLabel,
  title,
  description,
}: {
  axisLabel: string;
  title: string;
  description: string;
}) {
  return (
    <header className="px-6 py-5 sm:px-10">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-chart">
          {axisLabel}
        </span>
        {/* régua: liga o rótulo ao conteúdo, não é um eyebrow decorativo */}
        <svg
          viewBox="0 0 120 10"
          className="h-2.5 flex-1 text-chart"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1="0"
            y1="5"
            x2="120"
            y2="5"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {[0, 20, 40, 60, 80, 100, 120].map((x) => (
            <line
              key={x}
              x1={x}
              y1="1"
              x2={x}
              y2={x % 40 === 0 ? "9" : "6"}
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>
    </header>
  );
}
