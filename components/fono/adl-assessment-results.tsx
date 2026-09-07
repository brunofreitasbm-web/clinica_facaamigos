import { PrintButton } from "@/components/fono/print-button";
import { GroupedBarChart } from "@/components/fono/fono-charts";
import {
  computeAdlResults,
  computeFonologiaResults,
  ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY,
  FONOLOGIA_WORDS,
  FONOLOGIA_BANDS,
  type AdlManualScores,
  type AdlResponses,
  type FonoBand,
  type FonologiaResponses,
  type FonoInstrument,
} from "@/lib/fono-instruments";
import type { FonoAssessmentRow } from "@/lib/fono-assessments";

export function AdlAssessmentResults({
  instrument,
  bands,
  receptiveLabel,
  expressiveLabel,
  assessment,
}: {
  instrument: Extract<FonoInstrument, "adl" | "adl2">;
  bands: FonoBand[];
  receptiveLabel: string;
  expressiveLabel: string;
  assessment: FonoAssessmentRow;
}) {
  const responses = assessment.responses as AdlResponses;
  const manual = assessment.manualScores as unknown as AdlManualScores;
  const results = computeAdlResults(bands, responses, manual, {
    doubleCountExpressiveBandKey: instrument === "adl" ? ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY : undefined,
  });

  const fonologiaResults =
    instrument === "adl2"
      ? computeFonologiaResults(
          FONOLOGIA_WORDS,
          FONOLOGIA_BANDS,
          Object.fromEntries(
            Object.entries(assessment.responses)
              .filter(([k]) => k.startsWith("fono-"))
              .map(([k, v]) => [k.slice("fono-".length), v]),
          ) as FonologiaResponses,
        )
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="m-0 text-sm text-ink-soft">
          Aplicado em {new Date(`${assessment.testDate}T00:00:00`).toLocaleDateString("pt-BR")} por {assessment.assessedByName}
        </p>
        <PrintButton />
      </div>

      <section className="card">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
          Total de acertos por faixa etária
        </h6>
        <GroupedBarChart
          bars={results.bandTotals.map((b) => ({ label: b.bandLabel, a: b.receptiveTotal, b: b.expressiveTotal }))}
          maxValue={Math.max(1, ...results.bandTotals.map((b) => Math.max(b.receptiveTotal, b.expressiveTotal)))}
        />
        <p className="m-0 mt-2 text-xs text-ink-faint">
          <span style={{ color: "var(--color-chart)" }}>■</span> {receptiveLabel} · <span style={{ color: "var(--color-accent-2)" }}>■</span> {expressiveLabel}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Faixa etária</th>
                <th>{receptiveLabel}</th>
                <th>{expressiveLabel}</th>
              </tr>
            </thead>
            <tbody>
              {results.bandTotals.map((b) => (
                <tr key={b.bandKey}>
                  <td>{b.bandLabel}</td>
                  <td>{b.receptiveTotal}</td>
                  <td>{b.expressiveTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
          Escores
        </h6>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-faint">Total de acertos</dt>
            <dd className="m-0 text-right">{results.totalAcertosReceptivo}</dd>
            <dt className="text-ink-faint">Respostas incorretas</dt>
            <dd className="m-0 text-right">{results.incorretasReceptivo}</dd>
            <dt className="text-ink-faint">Última tarefa correta</dt>
            <dd className="m-0 text-right">{manual.ultimaTarefaCorretaReceptiva ?? "—"}</dd>
            <dt className="text-ink-faint">Escore bruto</dt>
            <dd className="m-0 text-right">{results.escoreBrutoReceptivo ?? "—"}</dd>
            <dt className="text-ink-faint">Escore padrão</dt>
            <dd className="m-0 text-right font-semibold">{manual.escorePadraoReceptivo ?? "—"}</dd>
          </dl>
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-faint">Total de acertos</dt>
            <dd className="m-0 text-right">{results.totalAcertosExpressivo}</dd>
            <dt className="text-ink-faint">Respostas incorretas</dt>
            <dd className="m-0 text-right">{results.incorretasExpressivo}</dd>
            <dt className="text-ink-faint">Última tarefa correta</dt>
            <dd className="m-0 text-right">{manual.ultimaTarefaCorretaExpressiva ?? "—"}</dd>
            <dt className="text-ink-faint">Escore bruto</dt>
            <dd className="m-0 text-right">{results.escoreBrutoExpressivo ?? "—"}</dd>
            <dt className="text-ink-faint">Escore padrão</dt>
            <dd className="m-0 text-right font-semibold">{manual.escorePadraoExpressivo ?? "—"}</dd>
          </dl>
        </div>
        <hr className="my-4" style={{ borderColor: "var(--color-divider)" }} />
        <p className="m-0 text-sm">Escore bruto da linguagem global: {results.escoreBrutoGlobal ?? "—"}</p>
        <p className="m-0 text-sm">Escore padrão da linguagem global: {manual.escorePadraoGlobal ?? "—"}</p>
        <p className="m-0 mt-1 text-lg font-semibold">Classificação: {results.classificacao ?? "—"}</p>
      </section>

      {instrument === "adl2" && fonologiaResults.length > 0 && (
        <section className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Observação da Aquisição Fonológica — contagem por faixa
          </h6>
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Faixa etária</th>
                  <th>+</th>
                  <th>−</th>
                  <th>N</th>
                  <th>R</th>
                  <th>NR</th>
                </tr>
              </thead>
              <tbody>
                {fonologiaResults.map((b) => (
                  <tr key={b.bandKey}>
                    <td>{b.bandLabel}</td>
                    <td>{b.counts["+"]}</td>
                    <td>{b.counts["-"]}</td>
                    <td>{b.counts.N}</td>
                    <td>{b.counts.R}</td>
                    <td>{b.counts.NR}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
          Objetivos prioritários (itens não adquiridos)
        </h6>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{receptiveLabel}</p>
            {results.objetivosPrioritariosReceptivo.length === 0 ? (
              <p className="text-sm text-ink-faint">Nenhum item marcado como erro nesta escala.</p>
            ) : (
              <ul className="m-0 flex flex-col gap-1 pl-4 text-sm">
                {results.objetivosPrioritariosReceptivo.map((item) => (
                  <li key={item.key}>
                    {item.num}. {item.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{expressiveLabel}</p>
            {results.objetivosPrioritariosExpressivo.length === 0 ? (
              <p className="text-sm text-ink-faint">Nenhum item marcado como erro nesta escala.</p>
            ) : (
              <ul className="m-0 flex flex-col gap-1 pl-4 text-sm">
                {results.objetivosPrioritariosExpressivo.map((item) => (
                  <li key={item.key}>
                    {item.num}. {item.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {assessment.observations && (
        <section className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
            Observações
          </h6>
          <p className="m-0 whitespace-pre-wrap text-sm">{assessment.observations}</p>
        </section>
      )}
    </div>
  );
}
