"use client";

import Link from "next/link";
import { useTransition } from "react";
import { INTAKE_STEP_CATALOG, type IntakeStepRow, type IntakeStepKey } from "@/lib/intake-steps";
import { fmtDate as fmtDateShared } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { registerFirstContact } from "@/app/recepcao/pacientes/actions";
import { completeIntakeStep } from "@/app/recepcao/pacientes/[id]/stage-actions";

const fmtDate = (iso: string) => fmtDateShared(iso, CLINIC_TIMEZONE);

/**
 * Checklist operacional de entrada (Módulo 3 MAAIS, slide 20) — mostra as 14
 * etapas na ordem do catálogo com status (pendente / concluída / não
 * aplicável), quem concluiu e quando. Etapas com trigger automático (a
 * maioria — ver migration 20260906000001_intake_journey.sql) não têm botão,
 * só refletem o estado; `manualSteps` cobre as poucas que dependem de
 * confirmação manual (grupo de WhatsApp, contrato enviado, pagamento) e
 * `links` aponta pra tela onde a etapa de fato acontece (anamnese, equipe,
 * reunião, PDI).
 *
 * As Server Actions (`registerFirstContact`, `completeIntakeStep`) são
 * importadas direto aqui em vez de recebidas por prop — uma função comum não
 * é serializável e não pode atravessar a fronteira Server→Client Component
 * (ver `node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md`).
 * Passá-las por prop foi o que causava o React #441 nesta tela.
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
  /**
   * Alguns `links` apontam pra fora de `/recepcao` (ex.: anamnese, PDI e
   * reuniões vivem em `/supervisao`). `lib/roles.ts` não libera esse
   * prefixo pra `recepcao` — o middleware simplesmente manda de volta pra
   * `/recepcao`, então o botão parecia clicável mas não levava a lugar
   * nenhum pra quem realmente usa esta tela no dia a dia. `navigable: false`
   * (default true) mostra o rótulo como texto informativo em vez de link.
   */
  links?: Partial<Record<IntakeStepKey, { label: string; href: string; navigable?: boolean }>>;
}) {
  const [isPending, startTransition] = useTransition();
  const byKey = new Map(steps.map((s) => [s.step_key, s]));

  function run(stepKey: IntakeStepKey) {
    startTransition(async () => {
      if (stepKey === "primeiro_contato") {
        await registerFirstContact(patientId);
      } else {
        await completeIntakeStep(patientId, stepKey);
      }
    });
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {INTAKE_STEP_CATALOG.map((def) => {
        const row = byKey.get(def.key);
        const status = row?.status ?? "pendente";
        const manualLabel = manualSteps[def.key];
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
            {status === "pendente" && manualLabel && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(def.key)}
                className="btn btn-ghost text-xs"
              >
                {manualLabel}
              </button>
            )}
            {status === "pendente" && !manualLabel && link && link.navigable !== false && (
              <Link href={link.href} className="btn btn-ghost text-xs no-underline">
                {link.label}
              </Link>
            )}
            {status === "pendente" && !manualLabel && link && link.navigable === false && (
              <span className="text-xs text-ink-faint">Aguardando ação da supervisão</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
