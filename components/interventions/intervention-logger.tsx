"use client";

import { useState, useTransition, useEffect } from "react";
import { recordIntervention, type InterventionLog } from "@/lib/intervention-actions";
import { interventionLabel, type InterventionCatalogItem } from "@/lib/intervention-catalog";

const RESULTADO_OPTIONS = [
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "resposta_parcial", label: "Resposta parcial" },
  { value: "resposta_esperada", label: "Resposta esperada" },
] as const;

interface InterventionLoggerProps {
  appointmentId: string;
  catalog: InterventionCatalogItem[];
  initialLogs?: InterventionLog[];
  onLogsChange?: (count: number) => void;
}

export function InterventionLogger({ appointmentId, catalog, initialLogs = [], onLogsChange }: InterventionLoggerProps) {
  const [logs, setLogs] = useState<InterventionLog[]>(initialLogs);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [resultado, setResultado] = useState<(typeof RESULTADO_OPTIONS)[number]["value"] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onLogsChange?.(logs.length);
  }, [logs, onLogsChange]);

  function handleSubmit(e?: React.SyntheticEvent) {
    if (e) e.preventDefault();
    if (!selectedValue) {
      setError("Selecione qual intervenção foi aplicada.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await recordIntervention(appointmentId, selectedValue, description, resultado);
      if (res.success && res.log) {
        setLogs((prev) => [...prev, res.log!]);
        setSelectedValue(null);
        setDescription("");
        setResultado(null);
        setIsOpen(false);
      } else {
        setError(res.error || "Erro ao salvar intervenção.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Intervenções aplicadas na sessão</h3>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all duration-200 shadow-sm"
        >
          <span>{isOpen ? "✕" : "＋"}</span>
          {isOpen ? "Fechar" : "Registrar intervenção"}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Qual intervenção o terapeuta aplicou?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSelectedValue(item.value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    selectedValue === item.value
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="intervention_description">
              Detalhe (opcional)
            </label>
            <input
              id="intervention_description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ex: Reforço social após tentativa independente no programa de imitação"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Resposta do paciente
            </label>
            <div className="flex gap-2">
              {RESULTADO_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setResultado(resultado === r.value ? null : r.value)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-bold transition ${
                    resultado === r.value
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-700 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50 transition"
          >
            {isPending ? "Gravando..." : "Salvar intervenção"}
          </button>
        </div>
      )}

      {logs.length > 0 ? (
        <div className="space-y-2 pt-2">
          {logs.map((log, index) => (
            <div
              key={log.id || index}
              className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {interventionLabel(catalog, log.intervention_value)}
                </span>
                {log.resultado && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold uppercase text-[10px] ${
                      log.resultado === "resposta_esperada"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : log.resultado === "resposta_parcial"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {RESULTADO_OPTIONS.find((r) => r.value === log.resultado)?.label}
                  </span>
                )}
              </div>
              {log.description && <p className="text-slate-600 dark:text-slate-300">{log.description}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Nenhuma intervenção registrada nesta sessão ainda.
        </p>
      )}
    </div>
  );
}
