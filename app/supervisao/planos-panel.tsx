"use client";

import { useMemo, useState, useTransition } from "react";
import { PLAN_GOAL_STATUS_STYLE } from "@/lib/appointment-status-style";
import { approvePlan, returnAllPendingGoals, returnGoal, validateGoal } from "./plan-actions";

export type PlanGoalRow = {
  id: string;
  description: string;
  domain: string;
  criterion: string | null;
  status: string;
};

export type PlanRow = {
  id: string;
  patientName: string;
  version: number;
  disciplines: string[];
  goals: PlanGoalRow[];
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
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(() => plans.find((p) => p.id === selectedId) ?? null, [plans, selectedId]);
  const pendingCount = selected ? selected.goals.filter((g) => g.status === "ativa").length : 0;

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
        <h6 style={{ color: "var(--color-accent-2-600)" }}>Fila de aprovação</h6>
        <h1 className="m-0 mb-6">Planos terapêuticos</h1>
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
            <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }}>
                  {selected.patientName} · {selected.disciplines.join(" · ") || "sem disciplina"}
                </h6>
                <h2 className="m-0">Plano · v{selected.version}</h2>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isPending}
                  onClick={() => runPlanAction(() => returnAllPendingGoals(selected.id))}
                  title="Devolve em lote todas as metas ainda pendentes deste plano."
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
            <p className="mb-6 max-w-[720px] text-[13px] text-ink-soft">
              Valide cada meta individualmente. Metas validadas viram <code className="text-xs">plan_goals</code>{" "}
              ativas e aparecem traduzidas no portal da família. O plano só pode ser aprovado com todas as metas
              validadas ou devolvidas.{" "}
              <span className="italic">
                (&quot;Devolver com notas&quot; não tem onde guardar texto no schema atual — devolve todas as metas
                pendentes de uma vez, sem observação persistida.)
              </span>
            </p>
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
                    </div>
                    <div className="mt-1.5 text-[13px] italic" style={{ color: "var(--color-accent-2-600)" }}>
                      Família vê: &ldquo;{goal.description}&rdquo;
                    </div>
                    {goal.status === "ativa" && (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={isPending}
                          onClick={() => runGoalAction(goal.id, () => returnGoal(selected.id, goal.id))}
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
