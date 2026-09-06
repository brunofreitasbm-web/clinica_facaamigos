import { FEEDBACK_CATEGORIES, FEEDBACK_RATING_LABEL, type FeedbackRatingValue } from "@/lib/family-feedback";

export type FamilyFeedbackRow = {
  id: string;
  patientName: string;
  guardianName: string | null;
  categoryRatings: Record<string, string>;
  comments: string | null;
  dateLabel: string;
};

export function FamilyFeedbackPanel({ items }: { items: FamilyFeedbackRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
        Avaliações da Família (portal · &quot;Avalie&quot;)
      </h6>

      {items.length === 0 && <p className="text-sm text-ink-faint">Nenhuma avaliação da família ainda.</p>}

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const hasNegative = Object.values(item.categoryRatings).includes("ruim");
          return (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-md border px-4 py-3"
              style={{
                borderColor: hasNegative ? "var(--status-falta, #d92d20)" : "var(--color-divider)",
                background: hasNegative ? "rgba(217,45,32,0.05)" : "transparent",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.patientName}</p>
                  {item.guardianName && <p className="text-xs text-ink-soft">{item.guardianName}</p>}
                </div>
                <span className="text-xs text-ink-faint">{item.dateLabel}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_CATEGORIES.filter((c) => item.categoryRatings[c.key]).map((c) => {
                  const value = item.categoryRatings[c.key] as FeedbackRatingValue;
                  const negative = value === "ruim";
                  return (
                    <span
                      key={c.key}
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        background: negative ? "var(--status-falta, #d92d20)" : "var(--color-accent-2-100)",
                        color: negative ? "#fff" : "var(--color-accent-2-700, var(--color-accent-2))",
                      }}
                    >
                      {c.label}: {FEEDBACK_RATING_LABEL[value]}
                    </span>
                  );
                })}
              </div>

              {item.comments && <p className="text-sm text-ink-soft italic">&quot;{item.comments}&quot;</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
