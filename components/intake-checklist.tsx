"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { INTAKE_STEP_CATALOG, type IntakeStepRow, type IntakeStepKey } from "@/lib/intake-steps";
import { fmtDate as fmtDateShared } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { registerFirstContact } from "@/app/recepcao/pacientes/actions";
import { completeIntakeStep } from "@/app/recepcao/pacientes/[id]/stage-actions";

const fmtDate = (iso: string) => fmtDateShared(iso, CLINIC_TIMEZONE);

/**
 * Checklist operacional de entrada aprimorado pelas Leis de UX:
 * - Goal-Gradient Effect: indicador de progresso geral motivando a finalização da jornada.
 * - Zeigarnik Effect: contagem visível de etapas pendentes incentivando a resolução.
 * - Doherty Threshold: feedback de carregamento (<200ms) durante a transição da ação.
 * - Fitts's Law: botões de ação e links com alvo de toque adequado e espaçado.
 */
export function IntakeChecklist({
  patientId,
  steps,
  manualSteps = {},
  links = {},
}: {
  patientId: string;
  steps: IntakeStepRow[];
  /** Chave da etapa → rótulo do botão, para as etapas concluídas manualmente. */
  manualSteps?: Partial<Record<IntakeStepKey, string>>;
  links?: Partial<Record<IntakeStepKey, { label: string; href: string; navigable?: boolean }>>;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<IntakeStepKey | null>(null);
  const byKey = new Map(steps.map((s) => [s.step_key, s]));

  const completedCount = steps.filter((s) => s.status === "concluida").length;
  const totalCount = INTAKE_STEP_CATALOG.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  function run(stepKey: IntakeStepKey) {
    setPendingKey(stepKey);
    startTransition(async () => {
      try {
        if (stepKey === "primeiro_contato") {
          await registerFirstContact(patientId);
        } else {
          await completeIntakeStep(patientId, stepKey);
        }
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Goal-Gradient & Zeigarnik header */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-ink">Etapas do Acolhimento</span>
          <span className="font-semibold text-accent tabular-nums">
            {completedCount} de {totalCount} concluídas ({progressPct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-2.5">
        {INTAKE_STEP_CATALOG.map((def) => {
          const row = byKey.get(def.key);
          const status = row?.status ?? "pendente";
          const manualLabel = manualSteps[def.key];
          const link = links[def.key];
          const isCurrentActionPending = isPending && pendingKey === def.key;

          return (
            <li
              key={def.key}
              className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg p-2 transition-colors hover:bg-neutral-50/80"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all ${
                    status === "concluida"
                      ? "bg-status-positive text-white shadow-2xs"
                      : status === "nao_aplicavel"
                        ? "bg-neutral-200 text-neutral-500"
                        : "bg-status-pending-soft text-status-pending-text border border-status-pending/30"
                  }`}
                >
                  {status === "concluida" ? (
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  ) : status === "nao_aplicavel" ? (
                    "—"
                  ) : (
                    "○"
                  )}
                </span>
                <div>
                  <div className={status === "concluida" ? "font-semibold text-ink" : "text-ink"}>{def.label}</div>
                  <div className="text-xs text-ink-faint">
                    {def.responsavel}
                    {status === "concluida" && row?.completed_at && ` · concluída ${fmtDate(row.completed_at)}`}
                    {status === "concluida" && row?.completedByName && ` por ${row.completedByName}`}
                    {status === "pendente" && row?.due_at && ` · prazo ${fmtDate(row.due_at)}`}
                    {status === "nao_aplicavel" && " · não se aplica a este paciente"}
                  </div>
                </div>
              </div>

              {status === "pendente" && manualLabel && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(def.key)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-accent/30 bg-accent-100/50 px-3.5 py-1 text-xs font-bold text-accent transition-all duration-150 hover:bg-accent hover:text-white active:scale-95 disabled:opacity-50"
                >
                  {isCurrentActionPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {manualLabel}
                </button>
              )}

              {status === "pendente" && !manualLabel && link && link.navigable !== false && (
                <Link
                  href={link.href}
                  className="inline-flex min-h-[36px] items-center rounded-full border border-neutral-300 bg-surface px-3.5 py-1 text-xs font-semibold text-ink transition-all duration-150 hover:bg-neutral-100 active:scale-95 no-underline"
                >
                  {link.label}
                </Link>
              )}

              {status === "pendente" && !manualLabel && link && link.navigable === false && (
                <span className="text-xs text-ink-faint italic">Aguardando ação da supervisão</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
