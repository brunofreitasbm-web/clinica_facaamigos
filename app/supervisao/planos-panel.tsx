"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, RotateCcw, CheckCircle2, MessageSquare, Loader2 } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);
  const [bulkNotes, setBulkNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredPlans = useMemo(() => {
    if (!searchTerm.trim()) return plans;
    const term = searchTerm.toLowerCase();
    return plans.filter(
      (p) =>
        p.patientName.toLowerCase().includes(term) ||
        p.disciplines.some((d) => d.toLowerCase().includes(term))
    );
  }, [plans, searchTerm]);

  const selected = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? filteredPlans[0] ?? null,
    [plans, selectedId, filteredPlans]
  );
  const pendingCount = selected ? selected.goals.filter((g) => g.status === "ativa").length : 0;
  const validatedCount = selected ? selected.goals.filter((g) => g.status === "validada").length : 0;
  const returnedCount = selected ? selected.goals.filter((g) => g.status === "suspensa").length : 0;

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
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      {/* Coluna Esquerda: Fila e Lista de Planos */}
      <div className="flex flex-col rounded-xl border border-paper-line bg-paper-surface p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">Fila de Supervisão</span>
            <h2 className="m-0 text-lg font-bold text-ink">Planos Terapêuticos</h2>
          </div>
          <Link
            href="/supervisao/planos/novo"
            className="btn btn-primary text-xs inline-flex items-center gap-1.5 no-underline"
            title="Montar novo Plano Terapêutico Singular (PTS) para um paciente"
          >
            ＋ Novo PTS
          </Link>
        </div>

        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por paciente ou disciplina..."
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {filteredPlans.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-faint">
            {searchTerm ? "Nenhum plano encontrado na busca." : "Nenhum plano aguardando aprovação."}
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {filteredPlans.map((plan) => {
              const tag = planQueueLabel(plan.goals);
              const isSelected = plan.id === (selected?.id ?? selectedId);
              const pCount = plan.goals.filter((g) => g.status === "ativa").length;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedId(plan.id)}
                  className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-accent/40 bg-accent/5 shadow-sm"
                      : "border-paper-line bg-paper hover:border-paper-line-strong hover:bg-paper-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-ink line-clamp-1">{plan.patientName}</span>
                    <span className={`tag-status text-[11px] px-2 py-0.5 ${tag.tagClass}`}>{tag.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-soft">
                    <span>{plan.disciplines.join(" · ") || "Geral"}</span>
                    <span className="font-mono text-[11px]">v{plan.version}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-faint pt-1 border-t border-paper-line/50">
                    <span>{plan.goals.length} meta(s)</span>
                    {pCount > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">{pCount} pendente(s)</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Pronto</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Coluna Direita: Detalhes e Revisão do Plano Selecionado */}
      <div className="flex flex-col rounded-xl border border-paper-line bg-paper-surface p-5 shadow-sm">
        {!selected ? (
          <div className="flex h-64 items-center justify-center text-sm text-ink-faint">
            Selecione um plano na lista ao lado para iniciar a revisão.
          </div>
        ) : (
          <>
            {/* Cabecalho de Acoes do Plano */}
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-paper-line pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                  <span>{selected.patientName}</span>
                  <span>·</span>
                  <span>{selected.disciplines.join(" · ") || "Multidisciplinar"}</span>
                </div>
                <h1 className="m-0 text-xl font-bold text-ink">Plano Terapêutico Singular (PTS) · v{selected.version}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <RelatorioReavaliacaoDialog data={reportData} />
                <button
                  type="button"
                  className="btn btn-secondary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                  disabled={isPending}
                  onClick={() => runPlanAction(() => returnAllPendingGoals(selected.id, bulkNotes))}
                  title="Devolve em lote todas as metas ainda pendentes deste plano"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Devolver Pendentes</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                  disabled={isPending || pendingCount > 0}
                  onClick={() => runPlanAction(() => approvePlan(selected.id))}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{pendingCount > 0 ? `Aprovar (${pendingCount} pendentes)` : "Aprovar e Publicar"}</span>
                </button>
              </div>
            </div>

            {/* Resumo de Metas e Status */}
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-paper-line bg-paper p-3 text-xs">
              <div className="flex flex-col">
                <span className="text-ink-faint">Pendentes de validação</span>
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">{pendingCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-ink-faint">Metas Validadas</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{validatedCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-ink-faint">Devolvidas para ajuste</span>
                <span className="text-base font-bold text-rose-600 dark:text-rose-400">{returnedCount}</span>
              </div>
            </div>

            {/* Contexto Clinico e Familia */}
            {(selected.generalObjective || selected.familyPriorities) && (
              <div className="mb-5 flex flex-col gap-2 rounded-lg border border-paper-line bg-paper/60 p-3.5 text-xs">
                {selected.generalObjective && (
                  <div>
                    <span className="font-semibold text-ink">Objetivo Geral: </span>
                    <span className="text-ink-soft">{selected.generalObjective}</span>
                  </div>
                )}
                {selected.familyPriorities && (
                  <div>
                    <span className="font-semibold text-ink">Prioridades da Família: </span>
                    <span className="text-ink-soft">{selected.familyPriorities}</span>
                  </div>
                )}
              </div>
            )}

            {/* Campo de observacao em lote */}
            <div className="mb-4">
              <textarea
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Observações do supervisor para devolução em lote (opcional)..."
                rows={2}
                className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {error}
              </div>
            )}

            {/* Lista de Metas do Plano */}
            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-bold text-ink">Metas Terapêuticas do Plano ({selected.goals.length})</h3>
              
              {selected.goals.length === 0 ? (
                <p className="text-xs text-ink-faint">Este plano ainda não possui metas cadastradas.</p>
              ) : (
                selected.goals.map((goal) => {
                  const style = PLAN_GOAL_STATUS_STYLE[goal.status] ?? { label: goal.status, tagClass: "st-cancelada" };
                  const busy = isPending && pendingGoalId === goal.id;

                  return (
                    <div
                      key={goal.id}
                      className="flex flex-col gap-2 rounded-lg border border-paper-line bg-paper p-4 transition-all hover:border-paper-line-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-ink">{goal.description}</span>
                        <span className={`tag-status text-[11px] px-2 py-0.5 ${style.tagClass}`}>{style.label}</span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                        <span className="font-medium text-accent">{goal.domain}</span>
                        {goal.criterion && <span>· Critério: {goal.criterion}</span>}
                        {goal.horizon && <span>· {HORIZON_LABEL[goal.horizon] ?? goal.horizon}</span>}
                        {goal.methodology && <span>· Metodologia: {METHODOLOGY_LABEL[goal.methodology] ?? goal.methodology}</span>}
                      </div>

                      {goal.strategy && (
                        <div className="text-xs text-ink-soft">
                          <span className="font-medium text-ink">Estratégia: </span>
                          {goal.strategy}
                        </div>
                      )}

                      {goal.supervisorNotes && (
                        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                          <span className="font-semibold">Observação do Supervisor: </span>
                          {goal.supervisorNotes}
                        </div>
                      )}

                      <div className="text-xs italic text-accent/80">
                        Visão da família: &ldquo;{goal.description}&rdquo;
                      </div>

                      {goal.status === "ativa" && (
                        <div className="mt-2 flex items-center justify-end gap-2 border-t border-paper-line/60 pt-2.5">
                          <button
                            type="button"
                            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                            disabled={isPending}
                            onClick={() => {
                              const notes = window.prompt("Observação para o terapeuta (opcional):") ?? undefined;
                              runGoalAction(goal.id, () => returnGoal(selected.id, goal.id, notes));
                            }}
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 text-amber-600" />}
                            <span>{busy ? "..." : "Devolver"}</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                            disabled={isPending}
                            onClick={() => runGoalAction(goal.id, () => validateGoal(selected.id, goal.id))}
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            <span>{busy ? "..." : "Validar Meta"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
