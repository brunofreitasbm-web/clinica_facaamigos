"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PLAN_GOAL_STATUS_STYLE } from "@/lib/appointment-status-style";
import type { PlanRow } from "./planos-panel";

export const HORIZON_LABEL: Record<string, string> = {
  curto: "Curto prazo",
  medio: "Médio prazo",
  longo: "Longo prazo",
};
export const METHODOLOGY_LABEL: Record<string, string> = {
  dtt: "DTT",
  naturalistico: "Ensino naturalístico",
  misto: "Misto",
  outra: "Outra",
};

/**
 * Visualização somente leitura do PTS, no formato de documento imprimível.
 * `autoPrint` abre a caixa de impressão assim que o documento é montado
 * (botão "Imprimir" da barra de ações); sem ele é o botão "Ver".
 */
export function PtsViewDialog({
  plan,
  autoPrint,
  onClose,
}: {
  plan: PlanRow;
  autoPrint: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  const statusLabel = plan.status === "aprovado" ? "PTS vigente" : "Rascunho (aguardando aprovação)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-paper shadow-2xl print:max-h-none print:w-full print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-paper-line bg-paper-subtle px-6 py-4 print:hidden">
          <h2 className="m-0 text-lg font-bold text-ink">Visualizar PTS</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary inline-flex items-center gap-1.5 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 text-ink print:overflow-visible print:p-6">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .pts-print-document, .pts-print-document * { visibility: visible; }
              .pts-print-document { position: absolute; left: 0; top: 0; width: 100%; }
            }
          `}</style>

          <div className="pts-print-document space-y-5">
            <div className="flex items-center justify-between border-b-2 border-accent pb-4">
              <Logo variant="horizontal" height={36} className="print:grayscale" />
              <div className="text-right text-xs text-ink-soft">
                <p className="m-0 text-sm font-semibold text-ink">Plano Terapêutico Singular (PTS)</p>
                <p className="m-0">
                  v{plan.version} · {statusLabel}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <span className="text-ink-faint">Paciente: </span>
                <span className="font-semibold">{plan.patientName}</span>
              </div>
              <div>
                <span className="text-ink-faint">Disciplinas: </span>
                <span className="font-semibold">{plan.disciplines.join(" · ") || "Multidisciplinar"}</span>
              </div>
            </div>

            {plan.generalObjective && (
              <section className="text-xs">
                <h3 className="m-0 mb-1 text-sm font-bold">Objetivo Geral</h3>
                <p className="m-0 whitespace-pre-wrap text-ink-soft">{plan.generalObjective}</p>
              </section>
            )}
            {plan.familyPriorities && (
              <section className="text-xs">
                <h3 className="m-0 mb-1 text-sm font-bold">Prioridades da Família</h3>
                <p className="m-0 whitespace-pre-wrap text-ink-soft">{plan.familyPriorities}</p>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="m-0 text-sm font-bold">Metas Terapêuticas ({plan.goals.length})</h3>
              {plan.goals.length === 0 ? (
                <p className="m-0 text-xs text-ink-faint">Este plano ainda não possui metas cadastradas.</p>
              ) : (
                plan.goals.map((goal, i) => {
                  const style = PLAN_GOAL_STATUS_STYLE[goal.status] ?? { label: goal.status };
                  return (
                    <div key={goal.id} className="break-inside-avoid rounded-lg border border-paper-line p-3 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold">
                          {i + 1}. {goal.description}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-soft">{style.label}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ink-soft">
                        <span className="font-medium">{goal.domain}</span>
                        {goal.criterion && <span>· Critério: {goal.criterion}</span>}
                        {goal.horizon && <span>· {HORIZON_LABEL[goal.horizon] ?? goal.horizon}</span>}
                        {goal.methodology && (
                          <span>· Metodologia: {METHODOLOGY_LABEL[goal.methodology] ?? goal.methodology}</span>
                        )}
                      </div>
                      {goal.strategy && (
                        <p className="m-0 mt-1 text-ink-soft">
                          <span className="font-medium text-ink">Estratégia: </span>
                          {goal.strategy}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
