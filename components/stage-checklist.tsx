const STAGES = [
  { n: 1, label: "Lead" },
  { n: 2, label: "Avaliação agendada" },
  { n: 3, label: "Avaliação realizada" },
  { n: 4, label: "Autorização" },
  { n: 5, label: "Grade montada" },
] as const;

export function StageChecklist({ stage }: { stage: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className="flex flex-col gap-2">
      {STAGES.map((s) => {
        const done = s.n < stage;
        const current = s.n === stage;
        return (
          <li key={s.n} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                done
                  ? "bg-status-positive text-paper"
                  : current
                    ? "bg-chart text-paper"
                    : "bg-status-neutral-soft text-status-neutral-text"
              }`}
            >
              {done ? "✓" : s.n}
            </span>
            <span className={current ? "font-medium text-ink" : "text-ink-soft"}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
