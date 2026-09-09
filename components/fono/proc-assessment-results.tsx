import { PrintButton } from "@/components/fono/print-button";
import { PrintLetterhead } from "@/components/brand/print-letterhead";
import { MaxAchievedBarChart } from "@/components/fono/fono-charts";
import { computeProcResults, PROC_CATALOG, PROC_REFERENCE_VALUES, type ProcResponses } from "@/lib/fono-instruments";
import type { FonoAssessmentRow } from "@/lib/fono-assessments";

function referenceKeyForAge(ageYears: number): "2anos" | "3anos" | null {
  if (ageYears === 2) return "2anos";
  if (ageYears === 3) return "3anos";
  return null;
}

export function ProcAssessmentResults({ assessment }: { assessment: FonoAssessmentRow }) {
  const results = computeProcResults(PROC_CATALOG, assessment.responses as ProcResponses);
  const refKey = referenceKeyForAge(assessment.ageYears);
  const reference = refKey ? PROC_REFERENCE_VALUES[refKey] : null;

  return (
    <div className="flex flex-col gap-6">
      <PrintLetterhead title="PROC — Protocolo de Observação Comportamental" subtitle={`Aplicado em ${new Date(`${assessment.testDate}T00:00:00`).toLocaleDateString("pt-BR")} por ${assessment.assessedByName}`} />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="m-0 text-sm text-ink-soft">
          Aplicado em {new Date(`${assessment.testDate}T00:00:00`).toLocaleDateString("pt-BR")} por {assessment.assessedByName} · idade na avaliação: {assessment.ageYears} anos e{" "}
          {assessment.ageMonths} meses
        </p>
        <PrintButton />
      </div>

      <section className="card">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
          Aspectos observados
        </h6>
        <MaxAchievedBarChart bars={results.sections.map((s) => ({ label: s.label.replace(/^\d\.\s*/, ""), max: s.max, achieved: s.score }))} />
        <div className="mt-4 overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Aspecto observado</th>
                <th>Pontuação máxima</th>
                <th>Pontuação alcançada</th>
              </tr>
            </thead>
            <tbody>
              {results.sections.map((s) => (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td>{s.max}</td>
                  <td>{s.score}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Total da pontuação</td>
                <td>{results.totalMax}</td>
                <td>{results.totalScore}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {reference && (
        <section className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
            Referência — Hage, Pereira &amp; Zorzi, Rev. CEFAC 2012;14(4):677-690
          </h6>
          <p className="m-0 mb-3 text-xs text-ink-faint">
            Amostra de {reference.n} crianças com desenvolvimento típico de linguagem, faixa {reference.label}. Os próprios autores registram que a
            amostra &ldquo;ainda não é suficiente para obter uma normatização&rdquo; — usar apenas como referência, não como norma.
          </p>
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th></th>
                  <th>Média</th>
                  <th>P25</th>
                  <th>P75</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Habilidades comunicativas</td>
                  <td>{reference.habilidadesComunicativas.media}</td>
                  <td>{reference.habilidadesComunicativas.p25}</td>
                  <td>{reference.habilidadesComunicativas.p75}</td>
                </tr>
                <tr>
                  <td>Compreensão da linguagem oral</td>
                  <td>{reference.compreensaoLinguagemOral.media}</td>
                  <td>{reference.compreensaoLinguagemOral.p25}</td>
                  <td>{reference.compreensaoLinguagemOral.p75}</td>
                </tr>
                <tr>
                  <td>Aspectos do desenvolvimento cognitivo</td>
                  <td>{reference.desenvolvimentoCognitivo.media}</td>
                  <td>{reference.desenvolvimentoCognitivo.p25}</td>
                  <td>{reference.desenvolvimentoCognitivo.p75}</td>
                </tr>
                <tr className="font-semibold">
                  <td>Total</td>
                  <td>{reference.total.media}</td>
                  <td>{reference.total.p25}</td>
                  <td>{reference.total.p75}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results.sections.map((s) => (
        <section key={s.key} className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
            {s.label}
          </h6>
          <ul className="m-0 flex flex-col gap-1 pl-0 text-sm" style={{ listStyle: "none" }}>
            {s.subsections.map((sub) => (
              <li key={sub.key} className="flex items-center justify-between border-b py-1.5" style={{ borderColor: "var(--color-divider)" }}>
                <span>{sub.label}</span>
                <span className="font-medium">
                  {sub.score} / {sub.max}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {assessment.observations && (
        <section className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
            Observações / Conclusões
          </h6>
          <p className="m-0 whitespace-pre-wrap text-sm">{assessment.observations}</p>
        </section>
      )}
    </div>
  );
}
