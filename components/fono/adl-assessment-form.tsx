"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFonoAssessment } from "@/lib/fono-assessment-actions";
import {
  computeAdlResults,
  computeFonologiaResults,
  ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY,
  FONOLOGIA_WORDS,
  FONOLOGIA_BANDS,
  FONOLOGIA_CODE_LABEL,
  type AdlItemResponse,
  type AdlManualScores,
  type AdlResponses,
  type FonoBand,
  type FonologiaCode,
  type FonologiaResponses,
  type FonoInstrument,
} from "@/lib/fono-instruments";
import type { FonoAssessmentRow } from "@/lib/fono-assessments";

const RESPONSE_OPTIONS: { value: AdlItemResponse; label: string }[] = [
  { value: "1", label: "Acerto" },
  { value: "0", label: "Erro" },
  { value: "NR", label: "NR" },
];
const FONOLOGIA_OPTIONS: FonologiaCode[] = ["+", "-", "N", "R", "NR"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyManual(): AdlManualScores {
  return {
    ultimaTarefaCorretaReceptiva: null,
    ultimaTarefaCorretaExpressiva: null,
    escorePadraoReceptivo: null,
    escorePadraoExpressivo: null,
    escorePadraoGlobal: null,
  };
}

export function AdlAssessmentForm({
  patientId,
  instrument,
  bands,
  receptiveLabel,
  expressiveLabel,
  assessment,
}: {
  patientId: string;
  instrument: Extract<FonoInstrument, "adl" | "adl2">;
  bands: FonoBand[];
  receptiveLabel: string;
  expressiveLabel: string;
  assessment: FonoAssessmentRow | null;
}) {
  const router = useRouter();
  const [testDate, setTestDate] = useState(assessment?.testDate ?? todayIso());
  const [responses, setResponses] = useState<AdlResponses>((assessment?.responses as AdlResponses) ?? {});
  const [fonologiaResponses, setFonologiaResponses] = useState<FonologiaResponses>(
    () =>
      Object.fromEntries(
        Object.entries(assessment?.responses ?? {})
          .filter(([k]) => k.startsWith("fono-"))
          .map(([k, v]) => [k.slice("fono-".length), v]),
      ) as FonologiaResponses,
  );
  const [manual, setManual] = useState<AdlManualScores>(() => ({ ...emptyManual(), ...(assessment?.manualScores as Partial<AdlManualScores>) }));
  const [observations, setObservations] = useState(assessment?.observations ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const results = useMemo(
    () =>
      computeAdlResults(bands, responses, manual, {
        doubleCountExpressiveBandKey: instrument === "adl" ? ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY : undefined,
      }),
    [bands, responses, manual, instrument],
  );

  const fonologiaResults = useMemo(
    () => (instrument === "adl2" ? computeFonologiaResults(FONOLOGIA_WORDS, FONOLOGIA_BANDS, fonologiaResponses) : []),
    [instrument, fonologiaResponses],
  );

  function buildFormData(finalize: boolean): FormData {
    const fd = new FormData();
    fd.set("test_date", testDate);
    const merged: Record<string, string> = { ...responses };
    for (const [num, code] of Object.entries(fonologiaResponses)) merged[`fono-${num}`] = code;
    fd.set("responses", JSON.stringify(merged));
    fd.set("manual_scores", JSON.stringify(manual));
    fd.set("observations", observations);
    if (finalize) fd.set("finalize", "1");
    return fd;
  }

  function handleSave(finalize: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await saveFonoAssessment(patientId, instrument, assessment?.id ?? null, buildFormData(finalize));
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/terapeuta/paciente/${patientId}/fono/${instrument}/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-8">
        <div className="card flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Data do teste</span>
            <input type="date" className="input" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </label>
        </div>

        {bands.map((band) => (
          <section key={band.key} className="card">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
              {band.label}
            </h6>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-faint">{receptiveLabel}</p>
                {band.receptive.map((item) => (
                  <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm" style={{ borderColor: "var(--color-divider)" }}>
                    <span>
                      {item.num}. {item.text}
                    </span>
                    <div className="seg">
                      {RESPONSE_OPTIONS.map((opt) => (
                        <label key={opt.value} className="seg-opt">
                          <input
                            type="radio"
                            name={`resp-${item.key}`}
                            checked={responses[item.key] === opt.value}
                            onChange={() => setResponses((prev) => ({ ...prev, [item.key]: opt.value }))}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-faint">{expressiveLabel}</p>
                {band.expressive.map((item) => (
                  <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm" style={{ borderColor: "var(--color-divider)" }}>
                    <span>
                      {item.num}. {item.text}
                    </span>
                    <div className="seg">
                      {RESPONSE_OPTIONS.map((opt) => (
                        <label key={opt.value} className="seg-opt">
                          <input
                            type="radio"
                            name={`resp-${item.key}`}
                            checked={responses[item.key] === opt.value}
                            onChange={() => setResponses((prev) => ({ ...prev, [item.key]: opt.value }))}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {instrument === "adl2" && (
          <section className="card">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Observação da Aquisição Fonológica e do Vocabulário
            </h6>
            <p className="m-0 mb-3 text-xs text-ink-faint">
              Não é um teste fonoaudiológico — anexo do ADL-2 para traçar um perfil de aquisição fonológica.{" "}
              {FONOLOGIA_OPTIONS.map((c) => `${c} = ${FONOLOGIA_CODE_LABEL[c]}`).join(" · ")}
            </p>
            <div className="flex flex-col gap-2">
              {FONOLOGIA_WORDS.map((word) => (
                <div key={word.number} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm" style={{ borderColor: "var(--color-divider)" }}>
                  <span>
                    {word.number}. {word.word} ({word.phonemes})
                  </span>
                  <div className="seg">
                    {FONOLOGIA_OPTIONS.map((code) => (
                      <label key={code} className="seg-opt">
                        <input
                          type="radio"
                          name={`fono-${word.number}`}
                          checked={fonologiaResponses[String(word.number)] === code}
                          onChange={() => setFonologiaResponses((prev) => ({ ...prev, [String(word.number)]: code }))}
                        />
                        {code}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Totais (automático)</h6>
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-faint">Total de acertos — {receptiveLabel}</dt>
            <dd className="m-0 text-right font-semibold">{results.totalAcertosReceptivo}</dd>
            <dt className="text-ink-faint">Total de acertos — {expressiveLabel}</dt>
            <dd className="m-0 text-right font-semibold">{results.totalAcertosExpressivo}</dd>
            <dt className="text-ink-faint">Respostas incorretas — {receptiveLabel}</dt>
            <dd className="m-0 text-right font-semibold">{results.incorretasReceptivo}</dd>
            <dt className="text-ink-faint">Respostas incorretas — {expressiveLabel}</dt>
            <dd className="m-0 text-right font-semibold">{results.incorretasExpressivo}</dd>
          </dl>
        </div>

        <div className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Escores</h6>
          <p className="m-0 mb-2 text-xs text-ink-faint">
            Consulte a tabela do manual do {instrument === "adl" ? "ADL" : "ADL-2"} para preencher os campos abaixo.
          </p>
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Última tarefa correta — {receptiveLabel}</span>
              <input
                type="number"
                className="input"
                value={manual.ultimaTarefaCorretaReceptiva ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, ultimaTarefaCorretaReceptiva: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </label>
            <p className="m-0 text-xs text-ink-faint">Escore bruto: {results.escoreBrutoReceptivo ?? "—"}</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Escore Padrão — {receptiveLabel}</span>
              <input
                type="number"
                className="input"
                value={manual.escorePadraoReceptivo ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, escorePadraoReceptivo: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </label>
            <hr style={{ borderColor: "var(--color-divider)" }} />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Última tarefa correta — {expressiveLabel}</span>
              <input
                type="number"
                className="input"
                value={manual.ultimaTarefaCorretaExpressiva ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, ultimaTarefaCorretaExpressiva: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </label>
            <p className="m-0 text-xs text-ink-faint">Escore bruto: {results.escoreBrutoExpressivo ?? "—"}</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Escore Padrão — {expressiveLabel}</span>
              <input
                type="number"
                className="input"
                value={manual.escorePadraoExpressivo ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, escorePadraoExpressivo: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </label>
            <hr style={{ borderColor: "var(--color-divider)" }} />
            <p className="m-0 text-xs text-ink-faint">Escore bruto da linguagem global: {results.escoreBrutoGlobal ?? "—"}</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Escore Padrão da Linguagem Global</span>
              <input
                type="number"
                className="input"
                value={manual.escorePadraoGlobal ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, escorePadraoGlobal: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </label>
            <p className="m-0 text-sm font-semibold">Classificação: {results.classificacao ?? "—"}</p>
          </div>
        </div>

        {instrument === "adl2" && fonologiaResults.length > 0 && (
          <div className="card">
            <h6 style={{ color: "var(--color-accent-2-600)" }}>Aquisição fonológica — contagem por faixa</h6>
            <ul className="m-0 flex flex-col gap-1 pl-0 text-xs" style={{ listStyle: "none" }}>
              {fonologiaResults.map((b) => (
                <li key={b.bandKey}>
                  <span className="font-medium">{b.bandLabel}:</span> + {b.counts["+"]} · − {b.counts["-"]} · N {b.counts.N} · R {b.counts.R} · NR {b.counts.NR}
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="card flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Observações</span>
          <textarea className="input" rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} />
        </label>
      </aside>
    </div>
  );
}
