"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTreatmentPlan } from "./actions";
import { DISCIPLINES } from "./disciplines";
import type { SuggestedGoal, TeamSuggestion } from "@/lib/plan-suggestions";

type Patient = { id: string; full_name: string };

type ProgramTargetType = "tentativa" | "duracao" | "frequencia" | "tarefa";

const TARGET_TYPE_LABEL: Record<ProgramTargetType, string> = {
  tentativa: "Tentativa (trial)",
  duracao: "Duração",
  frequencia: "Frequência",
  tarefa: "Tarefa (checklist)",
};

/**
 * Um "programa" ABA = alvo de coleta de dados por tentativa dentro de uma
 * meta (tabela `programs`, 20260904000005_treatment_plans.sql). Precisa de
 * ou um item de protocolo licenciado (`protocolItemId`, quando a meta veio
 * de uma sugestão de avaliação) ou um domínio livre (quando adicionado
 * manualmente — vira `domain_taxonomy` no server, ver actions.ts).
 */
type Program = {
  key: string;
  name: string;
  targetType: ProgramTargetType;
  masteryCriterion: string;
  protocolItemId: string | null;
  itemCode?: string;
};

type Goal = {
  key: string;
  discipline: string;
  domain: string;
  description: string;
  baseline: string;
  target: string;
  criterion: string;
  horizon: string;
  strategy: string;
  methodology: string;
  programs: Program[];
};

function emptyGoal(): Goal {
  return {
    key: crypto.randomUUID(),
    discipline: "",
    domain: "",
    description: "",
    baseline: "",
    target: "",
    criterion: "",
    horizon: "",
    strategy: "",
    methodology: "",
    programs: [],
  };
}

function emptyProgram(): Program {
  return { key: crypto.randomUUID(), name: "", targetType: "tentativa", masteryCriterion: "", protocolItemId: null };
}

const inputClass =
  "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function PlanForm({
  patients,
  initialPatientId = "",
  initialFamilyPriorities = "",
  suggestedGoals = [],
  teamSuggestions = [],
}: {
  patients: Patient[];
  initialPatientId?: string;
  initialFamilyPriorities?: string;
  suggestedGoals?: SuggestedGoal[];
  teamSuggestions?: TeamSuggestion[];
}) {
  const formId = useId();
  const router = useRouter();
  // Pré-seleção via ?paciente= (atalho "Montar PEI" da aba Fluxos da supervisão);
  // só vale se o id estiver na lista elegível (ativo/avaliacao).
  const [patientId, setPatientId] = useState(() =>
    patients.some((p) => p.id === initialPatientId) ? initialPatientId : "",
  );
  const [reviewDueAt, setReviewDueAt] = useState("");
  const [generalObjective, setGeneralObjective] = useState("");
  const [familyPriorities, setFamilyPriorities] = useState(initialFamilyPriorities);
  // Equipe de avaliação já definida (Módulo 3 MAAIS, slide 23) pré-marca as
  // disciplinas do plano assim que a página carrega — o supervisor só
  // precisa preencher sessões/semana, não redigitar quem já está na equipe.
  const [selectedDisciplines, setSelectedDisciplines] = useState<Record<string, string>>(() =>
    Object.fromEntries(teamSuggestions.map((t) => [t.discipline, "1"])),
  );
  const [goals, setGoals] = useState<Goal[]>([emptyGoal()]);
  const [addedSuggestionKeys, setAddedSuggestionKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addSuggestedGoal(s: SuggestedGoal) {
    setAddedSuggestionKeys((prev) => [...prev, s.key]);
    setSelectedDisciplines((prev) => (s.discipline in prev ? prev : { ...prev, [s.discipline]: "1" }));
    const filled: Goal = {
      key: crypto.randomUUID(),
      discipline: s.discipline,
      domain: s.domain,
      description: s.description,
      baseline: s.baseline,
      target: "",
      criterion: "",
      horizon: "",
      strategy: "",
      methodology: "",
      // Meta de ABA vinda de avaliação: cada item ainda não adquirido já
      // nasce como um programa de coleta por tentativa, pronto pra reunião
      // técnica só ajustar critério de mastery — sem isso a coleta de dados
      // do terapeuta (evolução) nunca teria o que mostrar.
      programs:
        s.discipline === "aba"
          ? s.pendingItems.map((item) => ({
              key: crypto.randomUUID(),
              name: item.description,
              targetType: "tentativa" as const,
              masteryCriterion: "80% de acertos em 3 sessões consecutivas",
              protocolItemId: item.id,
              itemCode: item.itemCode,
            }))
          : [],
    };
    setGoals((prev) => {
      const isFirstEmpty =
        prev.length === 1 && !prev[0].discipline && !prev[0].domain && !prev[0].description;
      return isFirstEmpty ? [filled] : [...prev, filled];
    });
  }

  function toggleDiscipline(value: string, checked: boolean) {
    setSelectedDisciplines((prev) => {
      const next = { ...prev };
      if (checked) {
        next[value] = next[value] ?? "1";
      } else {
        delete next[value];
      }
      return next;
    });
  }

  function updateSessoes(value: string, sessoesSemana: string) {
    setSelectedDisciplines((prev) => ({ ...prev, [value]: sessoesSemana }));
  }

  function updateGoal(key: string, field: keyof Omit<Goal, "key">, value: string) {
    setGoals((prev) => prev.map((g) => (g.key === key ? { ...g, [field]: value } : g)));
  }

  function removeGoal(key: string) {
    setGoals((prev) => (prev.length === 1 ? prev : prev.filter((g) => g.key !== key)));
  }

  function addProgram(goalKey: string) {
    setGoals((prev) =>
      prev.map((g) => (g.key === goalKey ? { ...g, programs: [...g.programs, emptyProgram()] } : g)),
    );
  }

  function updateProgram(
    goalKey: string,
    programKey: string,
    field: "name" | "targetType" | "masteryCriterion",
    value: string,
  ) {
    setGoals((prev) =>
      prev.map((g) =>
        g.key !== goalKey
          ? g
          : { ...g, programs: g.programs.map((p) => (p.key === programKey ? { ...p, [field]: value } : p)) },
      ),
    );
  }

  function removeProgram(goalKey: string, programKey: string) {
    setGoals((prev) =>
      prev.map((g) => (g.key === goalKey ? { ...g, programs: g.programs.filter((p) => p.key !== programKey) } : g)),
    );
  }

  function handleSubmit() {
    setError(null);

    if (!patientId) {
      setError("Selecione um paciente.");
      return;
    }

    const disciplineEntries = Object.entries(selectedDisciplines);
    if (disciplineEntries.length === 0) {
      setError("Selecione ao menos uma disciplina do plano.");
      return;
    }
    for (const [, raw] of disciplineEntries) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        setError("Sessões/semana precisa ser um número inteiro de pelo menos 1 para cada disciplina marcada.");
        return;
      }
    }

    const filledGoals = goals.filter((g) => g.discipline || g.domain || g.description);
    if (filledGoals.length === 0) {
      setError("Adicione ao menos uma meta.");
      return;
    }
    const incomplete = filledGoals.find((g) => !g.discipline || !g.domain.trim() || !g.description.trim());
    if (incomplete) {
      setError("Toda meta precisa de disciplina, domínio e descrição.");
      return;
    }

    const disciplineMix = Object.fromEntries(
      disciplineEntries.map(([value, raw]) => [value, { sessoesSemana: Number(raw) }]),
    );

    const formData = new FormData();
    formData.set("review_due_at", reviewDueAt);
    formData.set("general_objective", generalObjective);
    formData.set("family_priorities", familyPriorities);
    formData.set("discipline_mix", JSON.stringify(disciplineMix));
    formData.set(
      "goals",
      JSON.stringify(
        filledGoals.map((g) => ({
          discipline: g.discipline,
          domain: g.domain,
          description: g.description,
          baseline: g.baseline,
          target: g.target,
          criterion: g.criterion,
          horizon: g.horizon,
          strategy: g.strategy,
          methodology: g.methodology,
          programs: g.programs
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              targetType: p.targetType,
              masteryCriterion: p.masteryCriterion.trim() || null,
              protocolItemId: p.protocolItemId,
            })),
        })),
      ),
    );

    startTransition(async () => {
      const result = await createTreatmentPlan(patientId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/supervisao");
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8 p-6 sm:p-10">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-patient`}>
          Paciente
        </label>
        <select
          id={`${formId}-patient`}
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className={inputClass}
        >
          <option value="">Selecione…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        {patients.length === 0 && (
          <p className="mt-1 text-xs text-ink-faint">Nenhum paciente ativo ou em avaliação nesta clínica.</p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-objective`}>
          Objetivo geral do plano
        </label>
        <textarea
          id={`${formId}-objective`}
          value={generalObjective}
          onChange={(e) => setGeneralObjective(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-priorities`}>
          Prioridades relatadas pela família (da anamnese)
        </label>
        <textarea
          id={`${formId}-priorities`}
          value={familyPriorities}
          onChange={(e) => setFamilyPriorities(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      {teamSuggestions.length > 0 && (
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Equipe de avaliação já definida
          </div>
          <p className="mt-1 text-xs text-ink-faint">Disciplinas abaixo já vêm marcadas — só falta informar sessões/semana.</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
            {teamSuggestions.map((t, i) => (
              <li key={i}>
                {t.profileName} · {t.roleLabel}
                {t.discipline && (
                  <span className="text-ink-faint"> · {DISCIPLINES.find((d) => d.value === t.discipline)?.label ?? t.discipline}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestedGoals.length > 0 && (
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Sugestões de meta a partir da avaliação
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            Domínios com itens ainda não adquiridos nos protocolos já aplicados (Módulo 3 MAAIS, slide 27). Adicione e
            ajuste antes de salvar.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {suggestedGoals.map((s) => {
              const added = addedSuggestionKeys.includes(s.key);
              return (
                <li key={s.key} className="flex items-start justify-between gap-3 rounded-md border border-paper-line-strong bg-paper px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {s.domain} <span className="text-ink-faint">· {s.protocolLabel}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft">{s.description}</div>
                    <div className="mt-0.5 text-xs text-ink-faint">{s.baseline}</div>
                  </div>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addSuggestedGoal(s)}
                    className="shrink-0 rounded-md border border-paper-line-strong px-3 py-1.5 text-xs font-medium text-chart hover:border-chart disabled:opacity-40"
                  >
                    {added ? "Adicionada" : "+ Adicionar meta"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Disciplinas do plano</h2>
        <div className="mt-2 flex flex-col gap-2">
          {DISCIPLINES.map((d) => {
            const checked = d.value in selectedDisciplines;
            return (
              <div key={d.value} className="flex items-center gap-3">
                <input
                  id={`${formId}-disc-${d.value}`}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleDiscipline(d.value, e.target.checked)}
                />
                <label htmlFor={`${formId}-disc-${d.value}`} className="w-44 text-sm text-ink">
                  {d.label}
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  disabled={!checked}
                  value={selectedDisciplines[d.value] ?? ""}
                  onChange={(e) => updateSessoes(d.value, e.target.value)}
                  placeholder="Sessões/semana"
                  className="w-36 rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-sm text-ink disabled:opacity-50"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-review`}>
          Data de revisão (opcional)
        </label>
        <input
          id={`${formId}-review`}
          type="date"
          value={reviewDueAt}
          onChange={(e) => setReviewDueAt(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Metas (SMART)</h2>
          <button
            type="button"
            onClick={() => setGoals((prev) => [...prev, emptyGoal()])}
            className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs font-medium text-chart hover:border-chart"
          >
            + Adicionar meta
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-4">
          {goals.map((goal, index) => (
            <div key={goal.key} className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Meta {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeGoal(goal.key)}
                  disabled={goals.length === 1}
                  className="text-xs text-status-negative-text disabled:opacity-40"
                >
                  Remover
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Disciplina</label>
                  <select
                    value={goal.discipline}
                    onChange={(e) => updateGoal(goal.key, "discipline", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione…</option>
                    {DISCIPLINES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Domínio</label>
                  <input
                    value={goal.domain}
                    onChange={(e) => updateGoal(goal.key, "domain", e.target.value)}
                    placeholder="Ex: comunicação, autonomia…"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Meta (descrição)</label>
                  <textarea
                    value={goal.description}
                    onChange={(e) => updateGoal(goal.key, "description", e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Linha de base (opcional)</label>
                  <input
                    value={goal.baseline}
                    onChange={(e) => updateGoal(goal.key, "baseline", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Alvo (opcional)</label>
                  <input
                    value={goal.target}
                    onChange={(e) => updateGoal(goal.key, "target", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Critério de mastery (opcional)</label>
                  <input
                    value={goal.criterion}
                    onChange={(e) => updateGoal(goal.key, "criterion", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Horizonte</label>
                  <select
                    value={goal.horizon}
                    onChange={(e) => updateGoal(goal.key, "horizon", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione…</option>
                    <option value="curto">Curto prazo</option>
                    <option value="medio">Médio prazo</option>
                    <option value="longo">Longo prazo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Metodologia</label>
                  <select
                    value={goal.methodology}
                    onChange={(e) => updateGoal(goal.key, "methodology", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione…</option>
                    <option value="dtt">DTT (ensino estruturado)</option>
                    <option value="naturalistico">Ensino naturalístico</option>
                    <option value="misto">Misto</option>
                    <option value="outra">Outra</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                    Estratégia (o que exatamente será feito)
                  </label>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    Se dois terapeutas lerem esta meta, eles saberão exatamente o que ensinar e registrar?
                  </p>
                  <textarea
                    value={goal.strategy}
                    onChange={(e) => updateGoal(goal.key, "strategy", e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </div>
              </div>

              {goal.discipline === "aba" && (
                <div className="mt-4 border-t border-paper-line-strong pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                        Programas ABA (coleta por tentativa)
                      </h3>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        Cada programa vira um alvo que o terapeuta registra tentativa a tentativa na evolução da
                        sessão. Sem programa aqui, esta meta não gera coleta de dados.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProgram(goal.key)}
                      className="shrink-0 rounded-md border border-paper-line-strong px-3 py-1.5 text-xs font-medium text-chart hover:border-chart"
                    >
                      + Adicionar programa
                    </button>
                  </div>
                  {goal.programs.length === 0 && (
                    <p className="mt-2 text-xs text-ink-faint">Nenhum programa ainda.</p>
                  )}
                  <div className="mt-3 flex flex-col gap-2">
                    {goal.programs.map((program) => (
                      <div
                        key={program.key}
                        className="grid grid-cols-1 items-start gap-2 rounded-md border border-paper-line-strong bg-paper px-3 py-2 sm:grid-cols-[1fr_180px_1fr_auto]"
                      >
                        <div>
                          <label className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                            Nome do programa
                          </label>
                          <input
                            value={program.name}
                            disabled={!!program.protocolItemId}
                            onChange={(e) => updateProgram(goal.key, program.key, "name", e.target.value)}
                            placeholder="Ex: aponta para objetos ao ser nomeado"
                            className={`${inputClass} disabled:opacity-70`}
                          />
                          {program.itemCode && (
                            <p className="mt-0.5 text-[11px] text-ink-faint">Item {program.itemCode} do protocolo</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                            Tipo de registro
                          </label>
                          <select
                            value={program.targetType}
                            onChange={(e) =>
                              updateProgram(goal.key, program.key, "targetType", e.target.value)
                            }
                            className={inputClass}
                          >
                            {(Object.keys(TARGET_TYPE_LABEL) as ProgramTargetType[]).map((t) => (
                              <option key={t} value={t}>
                                {TARGET_TYPE_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                            Critério de mastery
                          </label>
                          <input
                            value={program.masteryCriterion}
                            onChange={(e) =>
                              updateProgram(goal.key, program.key, "masteryCriterion", e.target.value)
                            }
                            placeholder="Ex: 80% em 3 sessões"
                            className={inputClass}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProgram(goal.key, program.key)}
                          className="self-end text-xs text-status-negative-text sm:mb-2"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isPending ? "Salvando…" : "Criar plano em rascunho"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </div>
    </div>
  );
}
