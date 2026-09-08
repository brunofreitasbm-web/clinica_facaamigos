import { PrintButton } from "@/components/fono/print-button";
import { SOCIALLY_SAVVY_CATALOG, computeSociallySavvyResults, type SociallySavvyObjective } from "@/lib/socially-savvy";
import type { SociallySavvyAssessmentRow } from "@/lib/socially-savvy-assessments";

function percentLabel(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

function ObjectiveList({ title, hint, objectives }: { title: string; hint: string; objectives: SociallySavvyObjective[] }) {
  return (
    <section className="card">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
        {title}
      </h6>
      <p className="m-0 mb-3 text-xs text-ink-faint">{hint}</p>
      {objectives.length === 0 ? (
        <p className="m-0 text-sm text-ink-faint">Nenhuma habilidade nesta faixa.</p>
      ) : (
        <ul className="m-0 flex flex-col gap-2 pl-0 text-sm" style={{ listStyle: "none" }}>
          {objectives.map((objective) => (
            <li key={objective.code} className="border-b py-2" style={{ borderColor: "var(--color-divider)" }}>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{objective.areaLabel}</span>
              <p className="m-0">
                <span className="font-medium">{objective.code}.</span> {objective.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SociallySavvyAssessmentResults({ assessment }: { assessment: SociallySavvyAssessmentRow }) {
  // Recalculado a partir das respostas em vez de ler `assessment.results`: se a
  // regra de pontuação mudar, a tela reflete a regra atual sobre os dados
  // originais, como faz AdlAssessmentResults.
  const results = computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, assessment.responses);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="m-0 text-sm text-ink-soft">
          Aplicação {assessment.round} · {new Date(`${assessment.assessmentDate}T00:00:00`).toLocaleDateString("pt-BR")}{" "}
          por {assessment.assessedByName}
        </p>
        <PrintButton />
      </div>

      <section className="card">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
          Áreas do desenvolvimento social
        </h6>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Área</th>
                <th className="text-right">Pontos realizados</th>
                <th className="text-right">Pontos esperados</th>
                <th className="text-right">% acertos</th>
                <th className="text-right">Não avaliadas</th>
              </tr>
            </thead>
            <tbody>
              {results.areas.map((area) => (
                <tr key={area.key}>
                  <td>{area.label}</td>
                  <td className="text-right">{area.achieved}</td>
                  <td className="text-right">{area.expected}</td>
                  <td className="text-right font-semibold">{percentLabel(area.percent)}</td>
                  <td className="text-right">{area.naItems}</td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold">Total</td>
                <td className="text-right font-semibold">{results.totalAchieved}</td>
                <td className="text-right font-semibold">{results.totalExpected}</td>
                <td className="text-right font-semibold">{percentLabel(results.totalPercent)}</td>
                <td className="text-right" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ObjectiveList
        title="PEI — objetivos prioritários"
        hint="Habilidades pontuadas com 2: emergentes, o alvo imediato do plano."
        objectives={results.priorityObjectives}
      />
      <ObjectiveList
        title="PEI — demais objetivos"
        hint="Habilidades pontuadas com 0 e 1."
        objectives={results.otherObjectives}
      />

      {assessment.observations && (
        <section className="card">
          <h6 style={{ color: "var(--color-accent-2-600)" }}>Observações</h6>
          <p className="m-0 whitespace-pre-wrap text-sm">{assessment.observations}</p>
        </section>
      )}
    </div>
  );
}
