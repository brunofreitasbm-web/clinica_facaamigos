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
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-8">
        <div className="card flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Data do teste</span>
            <input type="date" className="input" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </label>
        </div>

        {PROC_CATALOG.map((section) => (
          <section key={section.key} className="card">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
              {section.label}
            </h6>
            <div className="flex flex-col gap-6">
              {section.subsections.map((sub) => (
                <div key={sub.key}>
                  <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{sub.label}</p>
                  {sub.mode === "scale012" && (
                    <div className="flex flex-col gap-2">
                      {sub.items.map((item) => (
                        <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm" style={{ borderColor: "var(--color-divider)" }}>
                          <span>{item.label}</span>
                          <div className="seg">
                            {[
                              { key: "0", label: "Ausente" },
                              { key: "1", label: "Raramente" },
                              { key: "2", label: "Frequentemente" },
                            ].map((opt) => (
                              <label key={opt.key} className="seg-opt">
                                <input
                                  type="radio"
                                  name={`${sub.key}-${item.key}`}
                                  checked={responses[`${sub.key}-${item.key}`] === opt.key}
                                  onChange={() => setResponse(`${sub.key}-${item.key}`, opt.key)}
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
                      <div key={item.key} className="mb-3 flex flex-col gap-1.5 text-sm">
                        {sub.items.length > 1 && <span className="text-ink-soft">{item.label}</span>}
                        <div className="flex flex-col gap-1">
                          {(item.options ?? []).map((opt) => (
                            <label key={opt.key} className="radio flex items-start gap-2 text-sm">
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
                    <div className="flex flex-col gap-1">
                      {sub.items.map((item) => (
                        <label key={item.key} className="radio flex items-start gap-2 text-sm">
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

        <section className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Características gerais (não pontuado)
          </h6>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PROC_GENERAL_CHECKLISTS.map((checklist) => (
              <div key={checklist.key}>
                <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{checklist.label}</p>
                <div className="flex flex-col gap-1">
                  {checklist.options.map((opt) => (
                    <label key={opt} className="radio flex items-start gap-2 text-sm">
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

        <label className="card flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Observações / Conclusões</span>
          <textarea className="input" rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-secondary" disabled={isPending} onClick={() => handleSave(false)}>
              {isPending ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button type="button" className="btn btn-primary" disabled={isPending} onClick={() => handleSave(true)}>
              {isPending ? "Salvando…" : "Concluir avaliação"}
            </button>
          </div>
          {error && <p className="text-xs text-status-negative-text">{error}</p>}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Pontuação (automático)</h6>
          <dl className="m-0 flex flex-col gap-1 text-sm">
            {results.sections.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <dt className="text-ink-faint">{s.label}</dt>
                <dd className="m-0 font-semibold">
                  {s.score} / {s.max}
                </dd>
              </div>
            ))}
          </dl>
          <hr className="my-3" style={{ borderColor: "var(--color-divider)" }} />
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total geral</span>
            <span>
              {results.totalScore} / {results.totalMax}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
