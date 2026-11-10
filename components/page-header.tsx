import type { ReactNode } from "react";
import { HelpHint } from "@/components/ui/help-hint";

/**
 * Cabeçalho de página. A descrição vira um "?" ao lado do título (menos texto
 * na tela, Lei de Hick/Miller). Use `descriptionVisible` apenas quando a
 * descrição carrega dado dinâmico ou aviso que precisa ficar à vista
 * (Von Restorff).
 */
export function PageHeader({
  axisLabel,
  title,
  description,
  descriptionVisible = false,
}: {
  axisLabel?: string;
  title: string;
  description?: ReactNode;
  descriptionVisible?: boolean;
}) {
  const hasDescription =
    description !== undefined && description !== null && description !== "";
  return (
    <header className="px-6 py-2 sm:px-10">
      {axisLabel ? (
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
      ) : null}
      <div className={`${axisLabel ? "mt-1 " : ""}flex items-center gap-1.5`}>
        <h1 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {hasDescription && !descriptionVisible ? (
          <HelpHint text={description} label={`Sobre ${title}`} side="bottom" />
        ) : null}
      </div>
      {hasDescription && descriptionVisible ? (
        <p className="mt-0.5 text-xs text-ink-soft">{description}</p>
      ) : null}
    </header>
  );
}
