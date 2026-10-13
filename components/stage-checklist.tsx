"use client";

import { Check } from "lucide-react";

const STAGES = [
  { n: 1, label: "Paciente sem avaliação" },
  { n: 2, label: "Avaliação agendada" },
  { n: 3, label: "Avaliação realizada" },
  { n: 4, label: "Autorização do plano" },
  { n: 5, label: "Grade terapêutica montada" },
] as const;

/**
 * StageChecklist aprimorado pelas Leis de UX:
 * - Goal-Gradient Effect: exibe % de conclusão e progresso visual em direção ao objetivo final.
 * - Law of Uniform Connectedness: linha vertical conectora unindo as etapas em um fluxo contínuo.
 * - Zeigarnik Effect: evidencia com clareza o próximo passo pendente a ser resolvido.
 * - Von Restorff Effect: destaca a etapa corrente com contraste e anel de foco.
 */
export function StageChecklist({ stage }: { stage: 1 | 2 | 3 | 4 | 5 }) {
  const percentComplete = Math.round(((stage - 1) / (STAGES.length - 1)) * 100);

  return (
    <div className="flex flex-col gap-3">
      {/* Goal-Gradient header */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-ink">Jornada do Paciente</span>
        <span className="font-semibold text-accent tabular-nums">
          Etapa {stage} de {STAGES.length} ({percentComplete}%)
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      <ol className="relative flex flex-col gap-3 pt-1">
        {STAGES.map((s, index) => {
          const done = s.n < stage;
          const current = s.n === stage;
          const isLast = index === STAGES.length - 1;

          return (
            <li key={s.n} className="relative flex items-center gap-3 text-sm">
              {/* Linha vertical conectora (Law of Uniform Connectedness) */}
              {!isLast && (
                <div
                  className={`absolute left-3.5 top-7 bottom--3 w-0.5 -translate-x-1/2 transition-colors ${
                    done ? "bg-status-positive" : "bg-neutral-200"
                  }`}
                  style={{ height: "calc(100% - 4px)" }}
                  aria-hidden="true"
                />
              )}

              <span
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  done
                    ? "bg-status-positive text-white shadow-2xs"
                    : current
                      ? "bg-accent text-white ring-4 ring-accent-100 shadow-xs"
                      : "bg-neutral-100 text-neutral-500 border border-neutral-300"
                }`}
              >
                {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : s.n}
              </span>

              <div className="flex flex-col">
                <span
                  className={`text-sm ${
                    current
                      ? "font-bold text-ink"
                      : done
                        ? "font-medium text-ink-muted"
                        : "text-neutral-500"
                  }`}
                >
                  {s.label}
                </span>
                {current && (
                  <span className="text-[11px] font-semibold text-accent">
                    ● Etapa em andamento
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
