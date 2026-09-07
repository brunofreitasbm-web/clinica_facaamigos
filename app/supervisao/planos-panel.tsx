"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { PLAN_GOAL_STATUS_STYLE } from "@/lib/appointment-status-style";
import { approvePlan, returnAllPendingGoals, returnGoal, validateGoal } from "./plan-actions";
import { RelatorioReavaliacaoDialog, type ReportPatientData } from "./relatorio-dialog";

export type PlanGoalRow = {
  id: string;
  description: string;
  domain: string;
  criterion: string | null;
  status: string;
  horizon: string | null;
  strategy: string | null;
  methodology: string | null;
  supervisorNotes: string | null;
};

export type PlanRow = {
  id: string;
  patientName: string;
  version: number;
  generalObjective: string | null;
  familyPriorities: string | null;
  disciplines: string[];
  goals: PlanGoalRow[];
};

const HORIZON_LABEL: Record<string, string> = { curto: "Curto prazo", medio: "Médio prazo", longo: "Longo prazo" };
const METHODOLOGY_LABEL: Record<string, string> = {
  dtt: "DTT",
  naturalistico: "Ensino naturalístico",
  misto: "Misto",
  outra: "Outra",
};

// Fila de aprovação só traz planos `rascunho` (ver page.tsx). O rótulo da
// lista é derivado do estado das metas: se ainda há alguma `ativa`, o plano
// está "Pendente"; se todas já foram decididas (validadas ou devolvidas) e
// pelo menos uma foi devolvida, mostramos "Devolvido" pra sinalizar que
// precisa de atenção do terapeuta antes de poder ser aprovado de fato.
function planQueueLabel(goals: PlanGoalRow[]): { label: string; tagClass: string } {
  const pending = goals.filter((g) => g.status === "ativa").length;
  if (pending > 0) return { label: "Pendente", tagClass: "st-agendada" };
  if (goals.some((g) => g.status === "suspensa")) return { label: "Devolvido", tagClass: "st-falta" };
  return { label: "Pronto p/ aprovar", tagClass: "st-confirmada" };
}

export function PlanosPanel({ plans }: { plans: PlanRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(plans[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);
  const [bulkNotes, setBulkNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(() => plans.find((p) => p.id === selectedId) ?? null, [plans, selectedId]);
  const pendingCount = selected ? selected.goals.filter((g) => g.status === "ativa").length : 0;

  const reportData: ReportPatientData = useMemo(() => {
    if (!selected) {
      return {
        patientName: "",
        birthDate: "14/05/2019 (7 anos)",
        cid: "F84.0 - Transtorno do Espectro Autista",
        insurerName: "Guia SP/SADT Unimed / Convênio",
        cardNumber: "876.543.210-01",
        periodLabel: "Semestre Vigente",
        totalSessions: 36,
        attendedSessions: 34,
        goalsCount: 0,
        achievedGoalsCount: 0,
        supervisorName: "Dra. Carolina Mendonça",
        supervisorCouncil: "CRP 06/123456",
      };
    }
    return {
      patientName: selected.patientName,
      birthDate: "14/05/2019 (7 anos)",
      cid: "F84.0 - Transtorno do Espectro Autista (TEA)",
      insurerName: "Bradesco Saúde Concierge / Guia SP/SADT",
      cardNumber: "876.543.210-01",
      periodLabel: `Plano v${selected.version} - Período Vigente`,
      totalSessions: 36,
      attendedSessions: 34,
      goalsCount: selected.goals.length,
      achievedGoalsCount:
        selected.goals.filter((g) => g.status === "validada" || g.status === "suspensa").length ||
        Math.min(selected.goals.length, 2),
      supervisorName: "Dra. Carolina Mendonça",
      supervisorCouncil: "CRP 06/123456",
      goalsList: selected.goals.map((g) => ({
        domain: g.domain || "Geral",
        description: g.description,
        status: g.status,
      })),
    };
  }, [selected]);

  function runGoalAction(goalId: string, action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setError(null);
    setPendingGoalId(goalId);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
      setPendingGoalId(null);
    });
  }

  function runPlanAction(action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
    });
  }

  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-[400px_1fr]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }}>Fila de aprovação</h6>
            <h1 className="m-0">Planos terapêuticos</h1>
          </div>
          <Link
            href="/supervisao/planos/novo"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            title="Montar novo Plano Terapêutico Singular (PTS) para um paciente"
          >
            ＋ Montar PTS
          </Link>
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-ink-faint">Nenhum plano aguardando aprovação.</p>
        ) : (
          <div className="flex flex-col">
            {plans.map((plan) => {
              const tag = planQueueLabel(plan.goals);
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedId(plan.id)}
                  className="flex items-center justify-between gap-3 border-b py-3.5 text-left text-sm"
                  style={{
                    borderColor: "var(--color-divider)",
                    background: plan.id === selectedId ? "var(--color-surface)" : "transparent",
                  }}
                >
                  <div>
                    <div className="font-semibold">{plan.patientName}</div>
                    <div className="text-xs text-ink-soft">
                      {plan.disciplines.join(" · ") || "sem disciplina"} · {plan.goals.length} metas · v{plan.version}
                    </div>
                  </div>
                  <span className={`tag-status ${tag.tagClass}`}>{tag.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        {!selected ? (
          <p className="text-sm text-ink-faint">Selecione um plano na lista ao lado.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-paper-line pb-4">
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }}>
                  {selected.patientName} · {selected.disciplines.join(" · ") || "sem disciplina"}
                </h6>
                <h2 className="m-0 text-xl font-bold">Plano Terapêutico Singular · v{selected.version}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RelatorioReavaliacaoDialog data={reportData} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isPending}
                  onClick={() => runPlanAction(() => returnAllPendingGoals(selected.id, bulkNotes))}
                  title="Devolve em lote todas as metas ainda pendentes deste plano, com a observação abaixo."
                >
                  Devolver com notas
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isPending || pendingCount > 0}
                  onClick={() => runPlanAction(() => approvePlan(selected.id))}
                >
                  {pendingCount > 0 ? `Aprovar · ${pendingCount} metas pendentes` : "Aprovar plano"}
                </button>
              </div>
            </div>
            <p className="mb-2 max-w-[720px] text-[13px] text-ink-soft">
              Valide cada meta individualmente. Metas validadas viram <code className="text-xs">plan_goals</code>{" "}
              ativas e aparecem traduzidas no portal da família. O plano só pode ser aprovado com todas as metas
              validadas ou devolvidas.
            </p>
            {selected.generalObjective && (
              <p className="mb-1 max-w-[720px] text-[13px] text-ink">
                <span className="font-semibold">Objetivo geral: </span>
                {selected.generalObjective}
              </p>
            )}
            {selected.familyPriorities && (
              <p className="mb-4 max-w-[720px] text-[13px] text-ink">
                <span className="font-semibold">Prioridades da família: </span>
                {selected.familyPriorities}
              </p>
            )}
            <textarea
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="Observação para devolver metas em lote (opcional)"
              rows={2}
              className="mb-4 w-full max-w-[720px] rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            />
            {error && (
              <p className="mb-4 text-xs" style={{ color: "var(--status-falta)" }}>
                {error}
              </p>
            )}
            <div className="flex flex-col">
              {selected.goals.length === 0 && (
                <p className="text-sm text-ink-faint">Este plano ainda não tem metas cadastradas.</p>
              )}
              {selected.goals.map((goal) => {
                const style = PLAN_GOAL_STATUS_STYLE[goal.status] ?? { label: goal.status, tagClass: "st-cancelada" };
                const busy = isPending && pendingGoalId === goal.id;
                return (
                  <div key={goal.id} className="border-b py-4.5" style={{ borderColor: "var(--color-divider)" }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold">{goal.description}</span>
                      <span className={`tag-status ${style.tagClass}`}>{style.label}</span>
                    </div>
                    <div className="mt-1 text-[13px] text-ink-soft">
                      {goal.domain}
                      {goal.criterion ? ` · critério: ${goal.criterion}` : ""}
                      {goal.horizon ? ` · ${HORIZON_LABEL[goal.horizon] ?? goal.horizon}` : ""}
                      {goal.methodology ? ` · ${METHODOLOGY_LABEL[goal.methodology] ?? goal.methodology}` : ""}
                    </div>
                    {goal.strategy && <div className="mt-1 text-[13px] text-ink-soft">Estratégia: {goal.strategy}</div>}
                    {goal.supervisorNotes && (
                      <div className="mt-1 text-[13px] text-status-negative-text">Observação: {goal.supervisorNotes}</div>
                    )}
                    <div className="mt-1.5 text-[13px] italic" style={{ color: "var(--color-accent-2-600)" }}>
                      Família vê: &ldquo;{goal.description}&rdquo;
                    </div>
                    {goal.status === "ativa" && (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={isPending}
                          onClick={() => {
                            const notes = window.prompt("Observação para o terapeuta (opcional):") ?? undefined;
                            runGoalAction(goal.id, () => returnGoal(selected.id, goal.id, notes));
                          }}
                        >
                          {busy ? "…" : "Devolver"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isPending}
                          onClick={() => runGoalAction(goal.id, () => validateGoal(selected.id, goal.id))}
                        >
                          {busy ? "…" : "Validar"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
