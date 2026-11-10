"use client";

import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { IntakeStage } from "../../../lib/intake-queue-pure.ts";

export const INTAKE_STAGE_TITLES: Record<IntakeStage, string> = {
  1: "Documentos recebidos",
  2: "Guia enviada ao plano",
  3: "Plano autorizou",
  4: "Habilitado para agendamento",
};

const STAGES: IntakeStage[] = [1, 2, 3, 4];

/**
 * Trilha de etapas da Fila de entrada, de cima para baixo: a etapa atual aberta, as concluídas em uma
 * linha (com conteúdo extra recolhido quando houver) e as futuras só com o título, sem botão.
 */
export function IntakeStageTrail({
  current,
  label,
  doneLine,
  doneExtra,
  children,
}: {
  current: IntakeStage;
  /** Texto da etapa calculado no servidor (draft.intake.label), ex.: "2 de 4 · Enviar guia". */
  label: string;
  /** Resumo de uma linha de cada etapa concluída. */
  doneLine: Partial<Record<IntakeStage, ReactNode>>;
  /** Conteúdo que abre a partir da linha de uma etapa concluída (ex.: "O que falta" na etapa 1). */
  doneExtra?: Partial<Record<IntakeStage, ReactNode>>;
  /** Corpo da etapa atual: situação, botão principal e ações secundárias. */
  children: ReactNode;
}) {
  return (
    <section aria-label="Etapas do caso" className="flex flex-col gap-2">
      <h3 className="m-0 text-base font-semibold text-slate-900">Etapa {label}</h3>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {STAGES.map((stage) => {
          const title = INTAKE_STAGE_TITLES[stage];
          if (stage < current) {
            const line = (
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800">{title}</span>
                  {doneLine[stage] ? <span className="text-slate-600"> · {doneLine[stage]}</span> : null}
                </span>
              </span>
            );
            const extra = doneExtra?.[stage];
            return (
              <li key={stage} className="rounded-xl border border-slate-200 bg-slate-50/60 text-sm">
                {extra ? (
                  <details className="group">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                      {line}
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" aria-hidden="true" />
                    </summary>
                    <div className="border-t border-slate-200 px-3 py-3">{extra}</div>
                  </details>
                ) : (
                  <div className="flex min-h-10 items-center px-3 py-2">{line}</div>
                )}
              </li>
            );
          }
          if (stage === current) {
            return (
              <li
                key={stage}
                aria-current="step"
                className="rounded-xl border-2 border-teal-600 bg-white px-4 py-3 text-sm shadow-xs"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white"
                  >
                    {stage}
                  </span>
                  <span className="text-base font-semibold text-slate-900">{title}</span>
                </div>
                <div className="flex flex-col gap-3">{children}</div>
              </li>
            );
          }
          return (
            <li
              key={stage}
              className="flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-sm"
              >
                {stage}
              </span>
              {title}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
