type Status = "positive" | "pending" | "active" | "negative" | "neutral";

const statusStyles: Record<
  Status,
  { dot: string; soft: string; text: string }
> = {
  positive: {
    dot: "bg-status-positive",
    soft: "bg-status-positive-soft",
    text: "text-status-positive-text",
  },
  pending: {
    dot: "bg-status-pending",
    soft: "bg-status-pending-soft",
    text: "text-status-pending-text",
  },
  active: {
    dot: "bg-status-active",
    soft: "bg-status-active-soft",
    text: "text-status-active-text",
  },
  negative: {
    dot: "bg-status-negative",
    soft: "bg-status-negative-soft",
    text: "text-status-negative-text",
  },
  neutral: {
    dot: "bg-status-neutral",
    soft: "bg-status-neutral-soft",
    text: "text-status-neutral-text",
  },
};

export function MeasurementCard({
  label,
  value,
  unit,
  status,
  milestone,
  placeholder = true,
  comparison,
}: {
  label: string;
  value: string;
  unit?: string;
  /** Ignorado quando placeholder=true — não veste um zero de veredito. */
  status?: Status;
  /** marco atingido — desenha a bandeirinha dourada no canto */
  milestone?: boolean;
  /** true (padrão nesta fase): valor ainda não é medição real. */
  placeholder?: boolean;
  /** Métrica de referência obrigatória de BI (ex.: vs. Mês Anterior, vs. Meta). */
  comparison?: string;
}) {
  const effectiveStatus: Status = placeholder ? "neutral" : (status ?? "neutral");
  const s = statusStyles[effectiveStatus];
  const showMilestone = milestone && !placeholder;

  return (
    <div className="relative overflow-hidden rounded-xl border border-paper-line-strong bg-paper/60 px-5 py-4 shadow-[0_1px_0_0_var(--color-paper-line-strong)] transition-all duration-150 hover:shadow-xs">
      {showMilestone && (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="absolute right-3 top-3 h-4 w-4 text-milestone"
          fill="currentColor"
        >
          <path d="M4 2v20h1.5v-7.5H18l-3-4.25L18 6H5.5V2z" />
        </svg>
      )}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          {label}
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold text-ink">
        <span className="tabular-figure">{value}</span>
        {unit && (
          <span className="ml-1 text-base font-normal text-ink-faint">
            {unit}
          </span>
        )}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.soft} ${s.text}`}
        >
          {placeholder ? "aguardando dado real" : statusLabel(effectiveStatus)}
        </span>
        {comparison && (
          <span className="text-xs font-medium text-ink-muted">
            {comparison}
          </span>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: Status) {
  switch (status) {
    case "positive":
      return "dentro da meta";
    case "pending":
      return "a confirmar";
    case "active":
      return "em atendimento";
    case "negative":
      return "atenção";
    case "neutral":
      return "sem dado";
  }
}
