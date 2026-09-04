"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTreatmentPlan } from "./actions";
import { DISCIPLINES } from "./disciplines";

type Patient = { id: string; full_name: string };

type Goal = {
  key: string;
  discipline: string;
  domain: string;
  description: string;
  baseline: string;
  target: string;
  criterion: string;
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
  };
}

const inputClass =
  "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function PlanForm({ patients }: { patients: Patient[] }) {
  const formId = useId();
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [reviewDueAt, setReviewDueAt] = useState("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<Goal[]>([emptyGoal()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
              </div>
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
