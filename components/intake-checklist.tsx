"use client";

import Link from "next/link";
import { useTransition } from "react";
import { INTAKE_STEP_CATALOG, type IntakeStepRow, type IntakeStepKey } from "@/lib/intake-steps";

type ActionResult = { success: boolean; error?: string };

const MANUAL_STEPS: Record<string, { label: string; action: (patientId: string) => Promise<ActionResult> } | undefined> = {};

/**
 * Checklist operacional de entrada (Módulo 3 MAAIS, slide 20) — mostra as 14
 * etapas na ordem do catálogo com status (pendente / concluída / não
 * aplicável), quem concluiu e quando. Etapas com trigger automático (a
 * maioria — ver migration 20260906000001_intake_journey.sql) não têm botão,
 * só refletem o estado; `manualActions` cobre as poucas que dependem de
 * confirmação manual (grupo de WhatsApp, contrato enviado, pagamento) e
 * `links` aponta pra tela onde a etapa de fato acontece (anamnese, equipe,
 * reunião, PDI).
 */
export function IntakeChecklist({
  patientId,
  steps,
  manualActions = MANUAL_STEPS,
  links = {},
  fmtDate,
}: {
  patientId: string;
  steps: IntakeStepRow[];
  manualActions?: Record<string, { label: string; action: (patientId: string) => Promise<ActionResult> } | undefined>;
  links?: Partial<Record<IntakeStepKey, { label: string; href: string }>>;
  fmtDate: (iso: string) => string;
}) {
  const [isPending, startTransition] = useTransition();
  const byKey = new Map(steps.map((s) => [s.step_key, s]));

  function run(action: (patientId: string) => Promise<ActionResult>) {
    startTransition(async () => {
      await action(patientId);
    });
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {INTAKE_STEP_CATALOG.map((def) => {
        const row = byKey.get(def.key);
        const status = row?.status ?? "pendente";
        const manual = manualActions[def.key];
        const link = links[def.key];
        return (
          <li key={def.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  status === "concluida"
                    ? "bg-status-positive text-paper"
                    : status === "nao_aplicavel"
                      ? "bg-status-neutral-soft text-status-neutral-text"
                      : "bg-status-pending-soft text-status-pending-text"
                }`}
              >
                {status === "concluida" ? "✓" : status === "nao_aplicavel" ? "—" : "○"}
              </span>
              <div>
                <div className={status === "concluida" ? "text-ink" : "text-ink-soft"}>{def.label}</div>
                <div className="text-xs text-ink-faint">
                  {def.responsavel}
                  {status === "concluida" && row?.completed_at && ` · concluída ${fmtDate(row.completed_at)}`}
                  {status === "concluida" && row?.completedByName && ` por ${row.completedByName}`}
                  {status === "pendente" && row?.due_at && ` · prazo ${fmtDate(row.due_at)}`}
                  {status === "nao_aplicavel" && " · não se aplica a este paciente"}
                </div>
              </div>
            </div>
            {status === "pendente" && manual && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(manual.action)}
                className="btn btn-ghost text-xs"
              >
                {manual.label}
              </button>
            )}
            {status === "pendente" && !manual && link && (
              <Link href={link.href} className="btn btn-ghost text-xs no-underline">
                {link.label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
