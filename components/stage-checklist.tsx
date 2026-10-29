"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link2 } from "lucide-react";
import { JOURNEY_STEPS, type Journey } from "@/lib/patient-journey-pure";

/**
 * StageChecklist aprimorado pelas Leis de UX:
 * - Goal-Gradient Effect: exibe % de conclusão e progresso visual em direção ao objetivo final.
 * - Law of Uniform Connectedness: linha vertical conectora unindo as etapas em um fluxo contínuo.
 * - Zeigarnik Effect: evidencia com clareza o próximo passo pendente a ser resolvido.
 * - Von Restorff Effect: destaca a etapa corrente com contraste e anel de foco.
 *
 * Somente leitura: o status real vem de `computeJourney`; `actionHref` é o
 * destino do botão (null quando o perfil de quem vê não pode agir) e
 * `shareHref` é o caminho que "Copiar link" entrega a outra pessoa.
 */
export function StageChecklist({
  journey,
  actionHref,
  shareHref,
}: {
  journey: Journey;
  actionHref?: string | null;
  shareHref?: string | null;
}) {
  const { step } = journey;
  const total = JOURNEY_STEPS.length;
  const percentComplete = Math.round(((step - 1) / (total - 1)) * 100);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!shareHref) return;
    try {
      await navigator.clipboard.writeText(new URL(shareHref, window.location.origin).toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard: o link continua na barra de endereço.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Status real do paciente */}
      <div className="rounded-lg border border-accent-100 bg-accent-100 p-3" role="status">
        <p className="text-sm font-bold text-ink">{journey.label}</p>
        {journey.detail && <p className="mt-0.5 text-xs text-ink-soft">{journey.detail}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {journey.ctaLabel && actionHref && (
            <Link href={actionHref} className="btn btn-primary text-xs no-underline">
              {journey.ctaLabel}
            </Link>
          )}
          {shareHref && (
            <button type="button" onClick={copyLink} className="btn text-xs">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? "Link copiado" : "Copiar link do status"}
            </button>
          )}
        </div>
      </div>

      {/* Goal-Gradient header */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-ink">Jornada do Paciente</span>
        <span className="font-semibold text-accent tabular-nums">
          Etapa {step} de {total} ({percentComplete}%)
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      <ol className="relative flex flex-col gap-3 pt-1">
        {JOURNEY_STEPS.map((s, index) => {
          const done = s.n < step;
          const current = s.n === step;
          const isLast = index === JOURNEY_STEPS.length - 1;

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
