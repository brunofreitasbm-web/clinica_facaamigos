// app/terapeuta/evolucao/[appointmentId]/trial-data-panel.tsx
"use client";

import { useState, useTransition } from "react";
import { recordTrial } from "./trial-data-actions";
import type { ProgramForCollection, TrialResult } from "@/lib/trial-data";

const RESULT_OPTIONS: { value: TrialResult; label: string }[] = [
  { value: "correto", label: "Acerto" },
  { value: "incorreto", label: "Erro" },
  { value: "ajuda", label: "Com ajuda" },
  { value: "nao_aplicado", label: "Não aplicado" },
];

type ProgramState = {
  trials: ProgramForCollection["trials"];
  result: TrialResult;
  promptLevel: string;
  durationS: string;
  error: string | null;
};

function initialState(program: ProgramForCollection): ProgramState {
  return {
    trials: program.trials,
    result: "correto",
    promptLevel: "",
    durationS: "",
    error: null,
  };
}

function summaryText(trials: ProgramForCollection["trials"]): string {
  if (trials.length === 0) return "Nenhuma tentativa registrada nesta sessão.";
  const correct = trials.filter((t) => t.result === "correto").length;
  const pct = Math.round((correct / trials.length) * 100);
  return `${correct} corretas de ${trials.length} tentativas — ${pct}%`;
}

export function TrialDataPanel({
  appointmentId,
  programs,
}: {
  appointmentId: string;
  programs: ProgramForCollection[];
}) {
  const [state, setState] = useState<Record<string, ProgramState>>(() =>
    Object.fromEntries(programs.map((program) => [program.id, initialState(program)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function updateProgram(programId: string, patch: Partial<ProgramState>) {
    setState((prev) => ({ ...prev, [programId]: { ...prev[programId], ...patch } }));
  }

  function handleSave(program: ProgramForCollection) {
    const current = state[program.id];
    updateProgram(program.id, { error: null });
    setSavingId(program.id);

    const formData = new FormData();
    formData.set("result", current.result);
    if (current.promptLevel.trim()) formData.set("prompt_level", current.promptLevel.trim());
    if (current.durationS.trim()) formData.set("duration_s", current.durationS.trim());

    startTransition(async () => {
      const result = await recordTrial(appointmentId, program.id, formData);
      setSavingId(null);
      if (!result.success) {
        updateProgram(program.id, { error: result.error });
        return;
      }
      setState((prev) => {
        const prog = prev[program.id];
        return {
          ...prev,
          [program.id]: {
            ...prog,
            trials: [...prog.trials, { trialIndex: result.trialIndex, result: current.result }],
            promptLevel: "",
            durationS: "",
          },
        };
      });
    });
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5 text-sm text-ink-faint">
        Nenhum programa ABA cadastrado.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Coleta de tentativas (ABA)
      </p>
      {programs.map((program) => {
        const ps = state[program.id];
        const isSaving = savingId === program.id;
        return (
          <div
            key={program.id}
            className="rounded-md border border-paper-line-strong bg-paper p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ink">{program.name}</p>
              <p className="text-xs text-ink-faint">{program.domain}</p>
            </div>
            <p className="mt-1 text-xs text-ink-soft">{summaryText(ps.trials)}</p>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <p className="text-xs text-ink-soft">Resultado</p>
                <div className="mt-1 flex gap-1">
                  {RESULT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateProgram(program.id, { result: opt.value })}
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${
                        ps.result === opt.value
                          ? "border-chart bg-chart text-paper"
                          : "border-paper-line-strong bg-paper text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-soft" htmlFor={`prompt-${program.id}`}>
                  Nível de ajuda (opcional)
                </label>
                <input
                  id={`prompt-${program.id}`}
                  type="text"
                  value={ps.promptLevel}
                  onChange={(e) => updateProgram(program.id, { promptLevel: e.target.value })}
                  placeholder="ex: verbal, gestual"
                  className="mt-1 block w-36 rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-xs text-ink-soft" htmlFor={`duration-${program.id}`}>
                  Duração (s, opcional)
                </label>
                <input
                  id={`duration-${program.id}`}
                  type="number"
                  min={0}
                  step="any"
                  value={ps.durationS}
                  onChange={(e) => updateProgram(program.id, { durationS: e.target.value })}
                  className="mt-1 block w-24 rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink"
                />
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave(program)}
                className="rounded-md bg-chart px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
              >
                {isSaving ? "Salvando…" : "Registrar tentativa"}
              </button>
            </div>
            {ps.error && <p className="mt-2 text-xs text-status-negative-text">{ps.error}</p>}
          </div>
        );
      })}
    </div>
  );
}
