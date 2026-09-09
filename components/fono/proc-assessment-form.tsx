"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFonoAssessment } from "@/lib/fono-assessment-actions";
import { computeProcResults, PROC_CATALOG, PROC_GENERAL_CHECKLISTS, type ProcResponses } from "@/lib/fono-instruments";
import type { FonoAssessmentRow } from "@/lib/fono-assessments";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ProcAssessmentForm({ patientId, assessment }: { patientId: string; assessment: FonoAssessmentRow | null }) {
  const router = useRouter();
  const [testDate, setTestDate] = useState(assessment?.testDate ?? todayIso());
  const [responses, setResponses] = useState<ProcResponses>((assessment?.responses as ProcResponses) ?? {});
  const [observations, setObservations] = useState(assessment?.observations ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const results = useMemo(() => computeProcResults(PROC_CATALOG, responses), [responses]);

  function setResponse(key: string, value: string) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  function buildFormData(finalize: boolean): FormData {
    const fd = new FormData();
    fd.set("test_date", testDate);
    fd.set("responses", JSON.stringify(responses));
    fd.set("manual_scores", JSON.stringify({}));
    fd.set("observations", observations);
    if (finalize) fd.set("finalize", "1");
    return fd;
  }

  function handleSave(finalize: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await saveFonoAssessment(patientId, "proc", assessment?.id ?? null, buildFormData(finalize));
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/terapeuta/paciente/${patientId}/fono/proc/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky Header de Resumo & Navegação por Seções PROC para Tablet */}
      <div className="sticky top-0 z-10 -mx-2 flex flex-col gap-3 border-b border-paper-line-strong bg-paper/95 px-3 py-3 shadow-xs backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-ink text-sm">Escore PROC Acumulado</span>
            <span className="rounded-full bg-paper-line-strong px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
              {results.totalScore} / {results.totalMax} pts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <span>Data:</span>
              <input
                type="date"
                className="input py-1 text-xs"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Atalhos Rápidos por Seção PROC (Subtest Quick Jump) */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 scroll-smooth">
          <span className="whitespace-nowrap text-[11px] font-semibold text-ink-faint">Seções:</span>
          {PROC_CATALOG.map((section) => {
            const secResult = results.sections.find((s) => s.key === section.key);
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`proc-${section.key}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex min-h-[38px] touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-full border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft transition-all hover:border-ink-soft active:scale-95"
              >
                <span>{section.label}</span>
                {secResult && (
                  <span className="rounded-full bg-paper-line-strong px-1.5 py-0.2 text-[10px] opacity-85">
                    {secResult.score}/{secResult.max}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          {PROC_CATALOG.map((section) => (
            <section
              key={section.key}
              id={`proc-${section.key}`}
              className="scroll-mt-36 rounded-xl border border-paper-line-strong bg-paper/60 p-4 sm:p-5"
            >
              <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-4 font-bold text-base">
                {section.label}
              </h6>
              <div className="flex flex-col gap-6">
                {section.subsections.map((sub) => (
                  <div key={sub.key} className="rounded-lg border border-paper-line-strong bg-paper/80 p-3 sm:p-4">
                    <p className="m-0 mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint border-b border-paper-line-strong pb-1.5">
                      {sub.label}
                    </p>
                    {sub.mode === "scale012" && (
                      <div className="flex flex-col gap-3">
                        {sub.items.map((item) => (
                          <div
                            key={item.key}
                            className="flex flex-col gap-2 rounded-md border border-paper-line-strong/60 bg-paper/50 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="text-sm font-medium text-ink">{item.label}</span>
                            <div className="seg min-h-[48px] touch-manipulation self-start sm:self-center">
                              {[
                                { key: "0", label: "Ausente" },
                                { key: "1", label: "Raramente" },
                                { key: "2", label: "Frequentemente" },
                              ].map((opt) => (
                                <label
                                  key={opt.key}
                                  className="seg-opt min-h-[48px] min-w-[56px] touch-manipulation justify-center font-bold text-xs active:scale-95 transition-transform"
                                >
                                  <input
                                    type="radio"
                                    name={`${sub.key}-${item.key}`}
                                    checked={responses[`${sub.key}-${item.key}`] === opt.key}
                                    onChange={() => setResponse(`${sub.key}-${item.key}`, opt.key)}
                                    className="sr-only"
                                  />
                                  {opt.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {sub.mode === "single" &&
                      sub.items.map((item) => (
                        <div key={item.key} className="mb-3 flex flex-col gap-2 text-sm">
                          {sub.items.length > 1 && <span className="font-semibold text-ink">{item.label}</span>}
                          <div className="flex flex-col gap-2">
                            {(item.options ?? []).map((opt) => (
                              <label
                                key={opt.key}
                                className="radio min-h-[44px] touch-manipulation flex items-center gap-3 rounded-md border border-paper-line-strong/60 bg-paper/50 px-3 py-2 text-sm active:scale-98 transition-transform cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={`${sub.key}-${item.key}`}
                                  checked={responses[`${sub.key}-${item.key}`] === opt.key}
                                  onChange={() => setResponse(`${sub.key}-${item.key}`, opt.key)}
                                />
                                <span>
                                  {opt.label} <span className="text-ink-faint">({opt.value} pts)</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                    {sub.mode === "multi" && (
                      <div className="flex flex-col gap-2">
                        {sub.items.map((item) => (
                          <label
                            key={item.key}
                            className="radio min-h-[44px] touch-manipulation flex items-center gap-3 rounded-md border border-paper-line-strong/60 bg-paper/50 px-3 py-2 text-sm active:scale-98 transition-transform cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={responses[`${sub.key}-${item.key}`] === "on"}
                              onChange={(e) => setResponse(`${sub.key}-${item.key}`, e.target.checked ? "on" : "")}
                            />
                            <span>
                              {item.label} <span className="text-ink-faint">({item.options?.[0]?.value ?? 0} pts)</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-xl border border-paper-line-strong bg-paper/60 p-4 sm:p-5">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3 font-bold text-base">
              Características gerais (não pontuado)
            </h6>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PROC_GENERAL_CHECKLISTS.map((checklist) => (
                <div key={checklist.key} className="rounded-lg border border-paper-line-strong bg-paper/80 p-3">
                  <p className="m-0 mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">{checklist.label}</p>
                  <div className="flex flex-col gap-2">
                    {checklist.options.map((opt) => (
                      <label
                        key={opt}
                        className="radio min-h-[40px] touch-manipulation flex items-center gap-2.5 rounded-md border border-paper-line-strong/60 bg-paper/50 px-2.5 py-1.5 text-xs active:scale-98 transition-transform cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={responses[`gc-${checklist.key}-${opt}`] === "on"}
                          onChange={(e) => setResponse(`gc-${checklist.key}-${opt}`, e.target.checked ? "on" : "")}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <label className="rounded-xl border border-paper-line-strong bg-paper/60 p-4 sm:p-5 flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">Observações / Conclusões</span>
            <textarea className="input" rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </label>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-paper-line-strong bg-paper/60 p-4">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3 font-bold">
              Pontuação (automático)
            </h6>
            <dl className="m-0 flex flex-col gap-2 text-xs">
              {results.sections.map((s) => (
                <div key={s.key} className="flex items-center justify-between border-b border-paper-line-strong pb-1.5">
                  <dt className="text-ink-soft font-medium">{s.label}</dt>
                  <dd className="m-0 font-bold text-ink">
                    {s.score} / {s.max}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center justify-between text-sm font-bold text-accent">
              <span>Total geral PROC</span>
              <span>
                {results.totalScore} / {results.totalMax} pts
              </span>
            </div>
          </div>
        </aside>

        {/* Floating Sticky Bottom Save Bar for Tablet Ergonomics */}
        <div className="col-span-1 xl:col-span-2 sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-line-strong bg-paper/95 p-3.5 shadow-lg backdrop-blur-md sm:p-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-ink">
              Total PROC: {results.totalScore} / {results.totalMax} pts
            </span>
            <span className="text-[11px] text-ink-faint">
              {isPending ? "Gravando avaliação no servidor..." : "Pronto para salvar ou concluir"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {error && <p className="text-xs text-status-negative-text font-medium">{error}</p>}
            <button
              type="button"
              className="btn btn-secondary min-h-[48px] px-4 text-sm font-medium touch-manipulation active:scale-95 transition-transform"
              disabled={isPending}
              onClick={() => handleSave(false)}
            >
              {isPending ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button
              type="button"
              className="btn btn-primary min-h-[48px] px-6 text-sm font-semibold touch-manipulation active:scale-95 transition-transform"
              disabled={isPending}
              onClick={() => handleSave(true)}
            >
              {isPending ? "Salvando…" : "Concluir avaliação"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
