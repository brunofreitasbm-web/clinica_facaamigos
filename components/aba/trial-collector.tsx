"use client";

import { useState, useTransition } from "react";
import { recordTrial } from "@/app/terapeuta/evolucao/[appointmentId]/trial-data-actions";
import { type ProgramWithTrials } from "@/lib/aba-actions";

interface TrialCollectorProps {
  appointmentId: string;
  initialPrograms: ProgramWithTrials[];
}

export function TrialCollector({ appointmentId, initialPrograms }: TrialCollectorProps) {
  const [programs, setPrograms] = useState<ProgramWithTrials[]>(initialPrograms);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    initialPrograms[0]?.id || ""
  );
  const [selectedPrompt, setSelectedPrompt] = useState<string>("Independente");
  const [isPending, startTransition] = useTransition();
  const [lastFeedback, setLastFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const currentProgram = programs.find((p) => p.id === selectedProgramId);

  function handleRecordResult(result: "correto" | "ajuda" | "incorreto") {
    if (!selectedProgramId) return;

    const formData = new FormData();
    formData.append("result", result);
    formData.append("prompt_level", result === "ajuda" ? selectedPrompt : "Nenhum");

    startTransition(async () => {
      const res = await recordTrial(appointmentId, selectedProgramId, formData);
      if (res.success) {
        setLastFeedback({
          text: `Tentativa #${res.trialIndex} registrada com sucesso!`,
          type: "success",
        });

        setPrograms((prev) =>
          prev.map((p) => {
            if (p.id === selectedProgramId) {
              return {
                ...p,
                trials: [
                  ...p.trials,
                  {
                    id: String(Date.now()),
                    trial_index: res.trialIndex,
                    result,
                    prompt_level: result === "ajuda" ? selectedPrompt : "Nenhum",
                    duration_s: null,
                    recorded_at: new Date().toISOString(),
                  },
                ],
              };
            }
            return p;
          })
        );
      } else {
        setLastFeedback({ text: res.error || "Erro ao gravar tentativa.", type: "error" });
      }

      setTimeout(() => setLastFeedback(null), 3000);
    });
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-amber-800 text-sm dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
        <p className="font-semibold flex items-center gap-2">
          ⚡ Nenhum programa ativo encontrado no PII/PEI deste paciente.
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Supervisores e terapeutas podem vincular programas de ensino às metas do plano terapêutico aprovado.
        </p>
      </div>
    );
  }

  const trialsList = currentProgram?.trials || [];
  const correctCount = trialsList.filter((t) => t.result === "correto").length;
  const promptCount = trialsList.filter((t) => t.result === "ajuda").length;
  const incorrectCount = trialsList.filter((t) => t.result === "incorreto").length;
  const totalTrials = trialsList.length;

  const pctIndependent = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Cabeçalho de Seleção de Programa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            ⚡ Coleta ABA em Tempo Real
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
            Tentativas Discretas (DTT / NET)
          </h3>
        </div>

        {/* Selector de Programa */}
        <select
          value={selectedProgramId}
          onChange={(e) => setSelectedProgramId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {programs.map((prog) => (
            <option key={prog.id} value={prog.id}>
              {prog.domain}: {prog.name} ({prog.trials.length} tent.)
            </option>
          ))}
        </select>
      </div>

      {/* Resumo do Programa Selecionado */}
      {currentProgram && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center bg-slate-50 p-3 rounded-lg dark:bg-slate-800/50">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Total Tentativas</span>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100">{totalTrials}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Independente (% acerto)</span>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{pctIndependent}%</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Com Dica/Ajuda</span>
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">{promptCount}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Incorreto</span>
            <p className="text-lg font-black text-rose-600 dark:text-rose-400">{incorrectCount}</p>
          </div>
        </div>
      )}

      {/* Botões Quick-Tap de Coleta */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Toque para Registrar Resultado da Tentativa
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Botão Independente / Acerto */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleRecordResult("correto")}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-3.5 px-4 text-emerald-900 font-black shadow-sm transition hover:bg-emerald-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
          >
            <span className="text-xl">✓</span>
            <span>Independente (Acerto)</span>
          </button>

          {/* Botão com Ajuda / Dica */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleRecordResult("ajuda")}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-3.5 px-4 text-amber-900 font-black shadow-sm transition hover:bg-amber-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
          >
            <span className="text-xl">💡</span>
            <span>Com Ajuda / Dica</span>
          </button>

          {/* Botão Incorreto */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleRecordResult("incorreto")}
            className="flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 py-3.5 px-4 text-rose-900 font-black shadow-sm transition hover:bg-rose-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
          >
            <span className="text-xl">✕</span>
            <span>Incorreto / Erro</span>
          </button>
        </div>

        {/* Nível de Dica (quando aplicável) */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs">
          <span className="text-slate-500 font-medium whitespace-nowrap">Nível de ajuda:</span>
          {["Física Total", "Física Parcial", "Gestual", "Verbal", "Visual", "Modelagem"].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setSelectedPrompt(prompt)}
              className={`rounded-full px-2.5 py-1 transition font-medium whitespace-nowrap ${
                selectedPrompt === prompt
                  ? "bg-amber-500 text-white font-bold"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Alerta de Feedback */}
      {lastFeedback && (
        <div
          className={`rounded-lg p-2.5 text-xs font-semibold flex items-center gap-2 transition ${
            lastFeedback.type === "success"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200"
              : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200"
          }`}
        >
          <span>{lastFeedback.type === "success" ? "🏆" : "⚠️"}</span>
          <span>{lastFeedback.text}</span>
        </div>
      )}

      {/* Histórico das últimas tentativas gravadas */}
      {trialsList.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Últimas tentativas nesta sessão:
          </span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {trialsList.slice(-10).map((t, idx) => (
              <span
                key={t.id || idx}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                  t.result === "correto"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : t.result === "ajuda"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                }`}
              >
                #{t.trial_index}: {t.result.toUpperCase()}
                {t.prompt_level && t.prompt_level !== "Nenhum" ? ` (${t.prompt_level})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
