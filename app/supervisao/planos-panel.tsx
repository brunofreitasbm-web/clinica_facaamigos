"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eye, Printer, RotateCcw, CheckCircle2, Loader2, Pencil, Save, X } from "lucide-react";
import { HORIZON_LABEL, METHODOLOGY_LABEL, PtsViewDialog } from "./pts-view-dialog";
import { PLAN_GOAL_STATUS_STYLE } from "@/lib/appointment-status-style";
import {
  approvePlan,
  returnAllPendingGoals,
  returnGoal,
  updatePlanContent,
  updatePlanGoal,
  validateGoal,
  type PlanGoalEditInput,
} from "./plan-actions";
import { DISCIPLINES } from "./planos/novo/disciplines";
import { RelatorioReavaliacaoDialog, type ReportPatientData } from "./relatorio-dialog";

export type PlanGoalRow = {
  id: string;
  discipline: string;
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
  /** rascunho = aguardando aprovação da supervisão; aprovado = PTS vigente. */
  status: "rascunho" | "aprovado";
  patientName: string;
  version: number;
  generalObjective: string | null;
  familyPriorities: string | null;
  disciplines: string[];
  goals: PlanGoalRow[];
};

const GOAL_STATUS_LABEL: Record<string, string> = { ativa: "Ativa", atingida: "Atingida", suspensa: "Suspensa" };

// A lista traz os rascunhos (fila de aprovação) e os planos `aprovado` (PTS
// vigentes, sempre à mostra — ver page.tsx). Plano aprovado é "Vigente". Para
// rascunho, o rótulo é derivado do estado das metas: se ainda há alguma
// `ativa`, o plano está "Pendente"; se todas já foram decididas (validadas ou
// devolvidas) e pelo menos uma foi devolvida, mostramos "Devolvido" pra
// sinalizar que precisa de atenção do terapeuta antes de poder ser aprovado.
function planQueueLabel(plan: PlanRow): { label: string; tagClass: string } {
  if (plan.status === "aprovado") return { label: "Vigente", tagClass: "st-confirmada" };
  const goals = plan.goals;
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
  // Edição do conteúdo do PTS (vale para rascunho e vigente). Os rascunhos
  // ficam em estado local até "Salvar"; "Cancelar" descarta tudo.
  const [editing, setEditing] = useState(false);
  // Visualização somente leitura ("Ver") e impressão direta ("Imprimir").
  const [viewMode, setViewMode] = useState<"ver" | "imprimir" | null>(null);
  const [contentDraft, setContentDraft] = useState({ generalObjective: "", familyPriorities: "" });
  const [goalDrafts, setGoalDrafts] = useState<Record<string, PlanGoalEditInput>>({});

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
  const isDraft = selected?.status === "rascunho";
  const pendingCount = selected ? selected.goals.filter((g) => g.status === "ativa").length : 0;
  const validatedCount = selected ? selected.goals.filter((g) => g.status === "validada").length : 0;
  const returnedCount = selected ? selected.goals.filter((g) => g.status === "suspensa").length : 0;

  const reportData: ReportPatientData = useMemo(() => {
    if (!selected) {
      return {
        patientName: "",
        birthDate: "14/05/2019 (7 anos)",
        cid: "F84.0 - Transtorno do Espectro Autista",
        insurerName: "Guia SP/SADT Unimed / Plano de Saúde",
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

  function startEditing() {
    if (!selected) return;
    setError(null);
    setContentDraft({
      generalObjective: selected.generalObjective ?? "",
      familyPriorities: selected.familyPriorities ?? "",
    });
    setGoalDrafts(
      Object.fromEntries(
        selected.goals.map((g) => [
          g.id,
          {
            discipline: g.discipline,
            description: g.description,
            domain: g.domain,
            criterion: g.criterion ?? "",
            horizon: g.horizon ?? "",
            strategy: g.strategy ?? "",
            methodology: g.methodology ?? "",
            status: g.status,
          },
        ])
      )
    );
    setEditing(true);
  }

  function goalChanged(goal: PlanGoalRow, draft: PlanGoalEditInput) {
    return (
      draft.discipline !== goal.discipline ||
      draft.status !== goal.status ||
      draft.description !== goal.description ||
      draft.domain !== goal.domain ||
      draft.criterion !== (goal.criterion ?? "") ||
      draft.horizon !== (goal.horizon ?? "") ||
      draft.strategy !== (goal.strategy ?? "") ||
      draft.methodology !== (goal.methodology ?? "")
    );
  }

  function saveEditing() {
    if (!selected) return;
    const planId = selected.id;
    setError(null);
    startTransition(async () => {
      const contentResult = await updatePlanContent(planId, contentDraft);
      if (!contentResult.success) {
        setError(contentResult.error);
        return;
      }
      for (const goal of selected.goals) {
        const draft = goalDrafts[goal.id];
        if (!draft || !goalChanged(goal, draft)) continue;
        const goalResult = await updatePlanGoal(planId, goal.id, draft);
        if (!goalResult.success) {
          setError(goalResult.error);
          return;
        }
      }
      setEditing(false);
    });
  }

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      {/* Coluna Esquerda: Fila e Lista de Planos */}
      <div className="flex flex-col rounded-xl border border-paper-line bg-paper-surface p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">PTS vigentes e a aprovar</span>
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
            {searchTerm ? "Nenhum plano encontrado na busca." : "Nenhum PTS vigente ou aguardando aprovação."}
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {filteredPlans.map((plan) => {
              const tag = planQueueLabel(plan);
              const isSelected = plan.id === (selected?.id ?? selectedId);
              const pCount = plan.goals.filter((g) => g.status === "ativa").length;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(plan.id);
                    setEditing(false);
                  }}
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
                    {plan.status === "aprovado" ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Aprovado</span>
                    ) : pCount > 0 ? (
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
                {editing ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                      disabled={isPending}
                      onClick={() => setEditing(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Cancelar</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                      disabled={isPending}
                      onClick={saveEditing}
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      <span>Salvar alterações</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                      onClick={() => setViewMode("ver")}
                      title="Visualizar este PTS em formato de documento"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                      onClick={() => setViewMode("imprimir")}
                      title="Imprimir este PTS"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Imprimir</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-1.5 text-xs transition-transform active:scale-95"
                      disabled={isPending}
                      onClick={startEditing}
                      title="Editar objetivo geral, prioridades da família e metas deste PTS"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Editar PTS</span>
                    </button>
                  </>
                )}
                {editing ? null : isDraft ? (
                  <>
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
                  </>
                ) : (
                  <span className="tag-status st-confirmada text-[11px] px-2 py-0.5">PTS vigente</span>
                )}
              </div>
            </div>

            {/* Resumo de Metas e Status */}
            {isDraft && (
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
            )}

            {/* Contexto Clinico e Familia — em edição vira formulário */}
            {editing ? (
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-paper-line bg-paper/60 p-3.5 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Objetivo Geral</span>
                  <textarea
                    value={contentDraft.generalObjective}
                    onChange={(e) => setContentDraft((d) => ({ ...d, generalObjective: e.target.value }))}
                    rows={2}
                    className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">Prioridades da Família</span>
                  <textarea
                    value={contentDraft.familyPriorities}
                    onChange={(e) => setContentDraft((d) => ({ ...d, familyPriorities: e.target.value }))}
                    rows={2}
                    className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </label>
              </div>
            ) : (selected.generalObjective || selected.familyPriorities) && (
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

            {/* Campo de observacao em lote (só rascunho: devolução em lote não se aplica a PTS vigente) */}
            {isDraft && !editing && (
            <div className="mb-4">
              <textarea
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Observações do supervisor para devolução em lote (opcional)..."
                rows={2}
                className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            )}

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
                  const draft = goalDrafts[goal.id];

                  if (editing && draft) {
                    const setField = (field: keyof PlanGoalEditInput, value: string) =>
                      setGoalDrafts((prev) => ({ ...prev, [goal.id]: { ...draft, [field]: value } }));
                    const inputClass =
                      "w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent";
                    return (
                      <div key={goal.id} className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-paper p-4">
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="font-semibold text-ink">Descrição *</span>
                          <textarea
                            value={draft.description}
                            onChange={(e) => setField("description", e.target.value)}
                            rows={2}
                            className={inputClass}
                          />
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="font-semibold text-ink">Disciplina *</span>
                            <select
                              value={draft.discipline}
                              onChange={(e) => setField("discipline", e.target.value)}
                              className={inputClass}
                            >
                              {DISCIPLINES.map((d) => (
                                <option key={d.value} value={d.value}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="font-semibold text-ink">Status</span>
                            <select
                              value={draft.status}
                              onChange={(e) => setField("status", e.target.value)}
                              className={inputClass}
                            >
                              {Object.entries(GOAL_STATUS_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="font-semibold text-ink">Domínio *</span>
                            <input
                              type="text"
                              value={draft.domain}
                              onChange={(e) => setField("domain", e.target.value)}
                              className={inputClass}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="font-semibold text-ink">Critério</span>
                            <input
                              type="text"
                              value={draft.criterion}
                              onChange={(e) => setField("criterion", e.target.value)}
                              className={inputClass}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="font-semibold text-ink">Prazo</span>
                            <select
                              value={draft.horizon}
                              onChange={(e) => setField("horizon", e.target.value)}
                              className={inputClass}
                            >
                              <option value="">—</option>
                              {Object.entries(HORIZON_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="font-semibold text-ink">Metodologia</span>
                            <select
                              value={draft.methodology}
                              onChange={(e) => setField("methodology", e.target.value)}
                              className={inputClass}
                            >
                              <option value="">—</option>
                              {Object.entries(METHODOLOGY_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="font-semibold text-ink">Estratégia</span>
                          <textarea
                            value={draft.strategy}
                            onChange={(e) => setField("strategy", e.target.value)}
                            rows={2}
                            className={inputClass}
                          />
                        </label>
                      </div>
                    );
                  }

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

                      {isDraft && !editing && goal.status === "ativa" && (
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
            {viewMode && (
              <PtsViewDialog plan={selected} autoPrint={viewMode === "imprimir"} onClose={() => setViewMode(null)} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
