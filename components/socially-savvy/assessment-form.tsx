"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSociallySavvyAssessment } from "@/lib/socially-savvy-assessment-actions";
import {
  SOCIALLY_SAVVY_CATALOG,
  SOCIALLY_SAVVY_ITEM_COUNT,
  SOCIALLY_SAVVY_SCORE_LABEL,
  SOCIALLY_SAVVY_SCORE_OPTIONS,
  computeSociallySavvyResults,
  type SociallySavvyResponses,
  type SociallySavvyScore,
} from "@/lib/socially-savvy";
import type { SociallySavvyAssessmentRow } from "@/lib/socially-savvy-assessments";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function percentLabel(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export function SociallySavvyAssessmentForm({
  patientId,
  round,
  assessment,
}: {
  patientId: string;
  round: number;
  assessment: SociallySavvyAssessmentRow | null;
}) {
  const router = useRouter();
  const [assessmentDate, setAssessmentDate] = useState(assessment?.assessmentDate ?? todayIso());
  const [responses, setResponses] = useState<SociallySavvyResponses>(assessment?.responses ?? {});
  const [observations, setObservations] = useState(assessment?.observations ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const results = useMemo(() => computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, responses), [responses]);
  const answered = SOCIALLY_SAVVY_ITEM_COUNT - results.areas.reduce((n, a) => n + a.unansweredItems, 0);

  function setScore(code: string, score: SociallySavvyScore) {
    setResponses((prev) => ({ ...prev, [code]: score }));
  }

  function handleSave(finalize: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set("assessment_date", assessmentDate);
    fd.set("round", String(round));
    fd.set("responses", JSON.stringify(responses));
    fd.set("observations", observations);
    if (finalize) fd.set("finalize", "1");

    startTransition(async () => {
      const result = await saveSociallySavvyAssessment(patientId, assessment?.id ?? null, fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/terapeuta/paciente/${patientId}/socially-savvy/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-8">
        <div className="card flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Data da avaliação</span>
            <input
              type="date"
              className="input"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
            />
          </label>
          <p className="m-0 text-sm text-ink-faint">
            Aplicação {round} de 4 · pontue de 0 a 3, ou NA quando a habilidade não foi avaliada.
          </p>
        </div>

        {SOCIALLY_SAVVY_CATALOG.map((area) => {
          const areaResult = results.areas.find((a) => a.key === area.key);
          return (
            <section key={area.key} className="card">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
                  {area.label}
                </h6>
                <span className="text-xs text-ink-faint">
                  {areaResult?.achieved ?? 0} / {areaResult?.expected ?? 0} pontos
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {area.items.map((item) => (
                  <div
                    key={item.code}
                    className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
                    style={{ borderColor: "var(--color-divider)" }}
                  >
                    <span>
                      <span className="font-medium">{item.code}.</span> {item.text}
                    </span>
                    <div className="seg">
                      {SOCIALLY_SAVVY_SCORE_OPTIONS.map((option) => (
                        <label key={option} className="seg-opt" title={SOCIALLY_SAVVY_SCORE_LABEL[option]}>
                          <input
                            type="radio"
                            name={`ss-${item.code}`}
                            checked={responses[item.code] === option}
                            onChange={() => setScore(item.code, option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

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
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Progresso</h6>
          <p className="m-0 text-sm">
            {answered} de {SOCIALLY_SAVVY_ITEM_COUNT} habilidades pontuadas
          </p>
        </div>

        <div className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Áreas (automático)</h6>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            {results.areas.map((area) => (
              <div key={area.key} className="contents">
                <dt className="text-ink-faint">{area.label}</dt>
                <dd className="m-0 text-right font-semibold">{percentLabel(area.percent)}</dd>
              </div>
            ))}
            <dt className="font-semibold">Total</dt>
            <dd className="m-0 text-right font-semibold">
              {results.totalAchieved} / {results.totalExpected} · {percentLabel(results.totalPercent)}
            </dd>
          </dl>
        </div>

        <div className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Prévia do PEI</h6>
          <p className="m-0 text-sm">
            {results.priorityObjectives.length} objetivos prioritários (pontuados com 2) ·{" "}
            {results.otherObjectives.length} demais objetivos (0 e 1)
          </p>
        </div>

        <label className="card flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Observações</span>
          <textarea className="input" rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} />
        </label>
      </aside>
    </div>
  );
}
