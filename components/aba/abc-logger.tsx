"use client";

import { useState, useTransition } from "react";
import { recordABCEvent, type ABCLog } from "@/lib/aba-actions";

interface ABCLoggerProps {
  appointmentId: string;
  initialLogs?: ABCLog[];
}

export function ABCLogger({ appointmentId, initialLogs = [] }: ABCLoggerProps) {
  const [logs, setLogs] = useState<ABCLog[]>(initialLogs);
  const [antecedent, setAntecedent] = useState("");
  const [behavior, setBehavior] = useState("");
  const [consequence, setConsequence] = useState("");
  const [intensity, setIntensity] = useState<"leve" | "moderada" | "grave">("leve");
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const QUICK_ANTECEDENTS = ["Instrução direta", "Retirada de item preferido", "Transição de atividade", "Ruído/Estímulo sensorial", "Livre brincar"];
  const QUICK_CONSEQUENCES = ["Redirecionamento", "Suporte sensorial", "Pausa estruturada", "Reforço diferencial", "Extinção/Ignorar"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!antecedent.trim() || !behavior.trim() || !consequence.trim()) {
      setError("Preencha o antecedente, comportamento e a consequência.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordABCEvent(appointmentId, antecedent, behavior, consequence, intensity);
      if (res.success && res.abcLog) {
        setLogs((prev) => [...prev, res.abcLog!]);
        setAntecedent("");
        setBehavior("");
        setConsequence("");
        setIntensity("leve");
        setIsOpen(false);
      } else {
        setError(res.error || "Erro ao salvar registro ABC.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Registro Funcional ABC (Antecedente - Comportamento - Consequência)
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition"
        >
          <span>{isOpen ? "✕" : "＋"}</span>
          {isOpen ? "Fechar Form" : "Registrar Ocorrência ABC"}
        </button>
      </div>

      {/* Form de Inclusão de Registro ABC */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Nova Ocorrência Comportamental na Sessão
          </p>

          {/* Antecedente */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Antecedente (A) — O que aconteceu logo antes?
            </label>
            <input
              type="text"
              value={antecedent}
              onChange={(e) => setAntecedent(e.target.value)}
              placeholder="Ex: Pedido de transição da massinha para a mesa"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {QUICK_ANTECEDENTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAntecedent(item)}
                  className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>

          {/* Comportamento */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Comportamento (B) — Descrição objetiva da ação observada
            </label>
            <input
              type="text"
              value={behavior}
              onChange={(e) => setBehavior(e.target.value)}
              placeholder="Ex: Gritou e jogou objeto no chão por 30 segundos"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Consequência */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Consequência (C) — O que ocorreu imediatamente após?
            </label>
            <input
              type="text"
              value={consequence}
              onChange={(e) => setConsequence(e.target.value)}
              placeholder="Ex: Oferecido suporte com ajuda tátil e redirecionamento"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {QUICK_CONSEQUENCES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setConsequence(item)}
                  className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>

          {/* Intensidade */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Intensidade da Ocorrência
            </label>
            <div className="flex gap-2">
              {(["leve", "moderada", "grave"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setIntensity(level)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-bold capitalize transition ${
                    intensity === level
                      ? level === "leve"
                        ? "bg-amber-500 text-white"
                        : level === "moderada"
                        ? "bg-orange-500 text-white"
                        : "bg-rose-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-700 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50 transition"
          >
            {isPending ? "Gravando..." : "Salvar Registro ABC"}
          </button>
        </form>
      )}

      {/* Lista de Registros Gravados */}
      {logs.length > 0 ? (
        <div className="space-y-2 pt-2">
          {logs.map((log, index) => (
            <div
              key={log.id || index}
              className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Ocorrência #{index + 1}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-bold uppercase text-[10px] ${
                    log.intensity === "grave"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : log.intensity === "moderada"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {log.intensity || "leve"}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                <strong className="text-slate-800 dark:text-slate-100">A:</strong> {log.antecedent} →{" "}
                <strong className="text-slate-800 dark:text-slate-100">B:</strong> {log.behavior_description} →{" "}
                <strong className="text-slate-800 dark:text-slate-100">C:</strong> {log.consequence}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Nenhuma ocorrência funcional ABC registrada nesta sessão.
        </p>
      )}
    </div>
  );
}
