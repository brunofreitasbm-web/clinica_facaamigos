"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { submitProtocolAssessment } from "@/lib/protocol-assessment-actions";
import { ASSESSMENT_SCORE_LABEL, type DomainTrend, type ProtocolTabData } from "@/lib/protocol-assessments";

const SCORE_VALUES = Object.keys(ASSESSMENT_SCORE_LABEL)
  .map(Number)
  .sort((a, b) => a - b);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function DomainTrendChart({ trend }: { trend: DomainTrend }) {
  const width = 240;
  const height = 56;
  const padding = 4;
  const { points } = trend;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - (p.pct / 100) * (height - padding * 2);
    return { x, y, p };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div className="rounded-md border border-paper-line-strong bg-paper/60 p-3">
      <p className="m-0 text-xs font-medium text-ink">{trend.domain}</p>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`Evolução — ${trend.domain}`}>
        <line
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
          stroke="var(--color-paper-line-strong)"
          strokeWidth={1}
        />
        <path d={path} fill="none" stroke="var(--color-chart)" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill="var(--color-chart)">
            <title>
              {formatDate(c.p.assessedAt)} · {c.p.pct}%
            </title>
          </circle>
        ))}
      </svg>
      <p className="m-0 text-xs text-ink-faint">{last.pct}% na última avaliação</p>
    </div>
  );
}

export function ProtocolAssessmentPanel({
  patientId,
  protocols,
}: {
  patientId: string;
  protocols: ProtocolTabData[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(protocols[0]?.id ?? null);
  const selected = useMemo(() => protocols.find((p) => p.id === selectedId) ?? null, [protocols, selectedId]);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Pré-preenche o rascunho com a última avaliação deste protocolo ao trocar
  // de aba — reavaliação normalmente muda só alguns marcos, não todos.
  useEffect(() => {
    const latest = selected?.assessments[selected.assessments.length - 1] ?? null;
    setScores(latest?.scores ?? {});
    setSuccess(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const domains = useMemo(() => (selected ? [...new Set(selected.items.map((i) => i.domain))] : []), [selected]);

  function handleSubmit() {
    if (!selected) return;
    setError(null);
    setSuccess(false);
    const formData = new FormData();
    formData.set("scores", JSON.stringify(scores));
    startTransition(async () => {
      const result = await submitProtocolAssessment(patientId, selected.id, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  if (protocols.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-ink-soft">
          Nenhum protocolo licenciado com marcos cadastrados e visíveis para você ainda. Peça ao gestor pra cadastrar
          os itens em Cadastros → Terapias.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {protocols.length > 1 && (
        <div className="seg w-fit">
          {protocols.map((p) => (
            <label key={p.id} className="seg-opt">
              <input type="radio" name="protocol-tab" checked={p.id === selectedId} onChange={() => setSelectedId(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            {domains.map((domain) => (
              <section key={domain}>
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
                  {domain}
                </h6>
                <div className="flex flex-col gap-2">
                  {selected.items
                    .filter((i) => i.domain === domain)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b py-2.5"
                        style={{ borderColor: "var(--color-divider)" }}
                      >
                        <div className="max-w-[420px]">
                          <span className="text-sm font-medium text-ink">{item.itemCode}</span>
                          {item.level && <span className="ml-2 text-xs text-ink-faint">{item.level}</span>}
                          <p className="m-0 text-[13px] text-ink-soft">{item.description}</p>
                        </div>
                        <div className="seg">
                          {SCORE_VALUES.map((value) => (
                            <label key={value} className="seg-opt">
                              <input
                                type="radio"
                                name={`score-${item.id}`}
                                checked={scores[item.id] === value}
                                onChange={() => setScores((prev) => ({ ...prev, [item.id]: value }))}
                              />
                              {ASSESSMENT_SCORE_LABEL[value]}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            ))}

            <div className="flex flex-col gap-2">
              <button type="button" className="btn btn-primary w-fit" disabled={isPending} onClick={handleSubmit}>
                {isPending ? "Salvando…" : "Salvar avaliação de hoje"}
              </button>
              {error && <p className="text-xs text-status-negative-text">{error}</p>}
              {success && (
                <p className="text-xs" style={{ color: "var(--status-realizada)" }}>
                  Avaliação registrada.
                </p>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <h6 style={{ color: "var(--color-accent-2-600)" }}>Evolução por domínio</h6>
            {selected.domainTrends.length === 0 ? (
              <p className="text-sm text-ink-faint">Ainda sem avaliações suficientes para comparar.</p>
            ) : (
              selected.domainTrends.map((trend) => <DomainTrendChart key={trend.domain} trend={trend} />)
            )}

            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mt-4">
              Histórico
            </h6>
            {selected.assessments.length === 0 ? (
              <p className="text-sm text-ink-faint">Nenhuma avaliação aplicada ainda.</p>
            ) : (
              <ul className="m-0 flex flex-col gap-1 pl-0 text-xs text-ink-soft" style={{ listStyle: "none" }}>
                {[...selected.assessments].reverse().map((a) => (
                  <li key={a.id}>
                    {formatDate(a.assessedAt)} · {a.assessedByName} · {Object.keys(a.scores).length} marcos pontuados
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
