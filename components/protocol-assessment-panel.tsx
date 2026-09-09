"use client";

import { useMemo, useState, useTransition } from "react";
import { submitProtocolAssessment } from "@/lib/protocol-assessment-actions";
import type { DomainTrend, ProtocolScale, ProtocolTabData } from "@/lib/protocol-assessments";

function scoreValues(scale: ProtocolScale): number[] {
  return Object.keys(scale.labels)
    .map(Number)
    .sort((a, b) => a - b);
}

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

// Uma instância por protocolo, remontada via `key={protocol.id}` no
// componente-pai — assim o rascunho de pontuação (pré-preenchido com a
// última avaliação) reseta sozinho ao trocar de aba, sem precisar de um
// efeito síncrono chamando setState (anti-padrão: ver "You Might Not Need
// an Effect").
function AssessmentForm({ patientId, protocol }: { patientId: string; protocol: ProtocolTabData }) {
  const latest = protocol.assessments[protocol.assessments.length - 1] ?? null;
  const [scores, setScores] = useState<Record<string, number>>(latest?.scores ?? {});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const domains = useMemo(() => [...new Set(protocol.items.map((i) => i.domain))], [protocol.items]);
  const values = useMemo(() => scoreValues(protocol.scale), [protocol.scale]);

  const totalItems = protocol.items.length;
  const scoredCount = useMemo(() => Object.keys(scores).length, [scores]);
  const pct = totalItems > 0 ? Math.round((scoredCount / totalItems) * 100) : 0;

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    const formData = new FormData();
    formData.set("scores", JSON.stringify(scores));
    startTransition(async () => {
      const result = await submitProtocolAssessment(patientId, protocol.id, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky Header de Resumo & Atuação em Tablet */}
      <div className="sticky top-0 z-10 -mx-2 flex flex-col gap-2 border-b border-paper-line-strong bg-paper/95 px-3 py-3 shadow-xs backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">Progresso do Protocolo</span>
            <span className="rounded-full bg-paper-line-strong px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
              {scoredCount} de {totalItems} marcos
            </span>
          </div>
          <span className="font-bold text-accent">{pct}% concluído</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-paper-line-strong">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Atalhos Rápidos por Domínio (Navegação por Toque em Tablet) */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 scroll-smooth">
          <span className="whitespace-nowrap text-[11px] font-semibold text-ink-faint">Atalho por domínio:</span>
          {domains.map((d) => {
            const domainItems = protocol.items.filter((i) => i.domain === d);
            const domainScored = domainItems.filter((i) => scores[i.id] !== undefined).length;
            const isComplete = domainScored === domainItems.length && domainItems.length > 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`domain-${d.replace(/\s+/g, "-")}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex min-h-[38px] touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                  isComplete
                    ? "border-status-positive-border bg-status-positive-bg text-status-positive-text"
                    : domainScored > 0
                    ? "border-accent-2-300 bg-accent-2-100 text-accent-2-700"
                    : "border-paper-line-strong bg-paper text-ink-soft hover:border-ink-soft"
                }`}
              >
                <span>{d}</span>
                <span className="rounded-full border border-current px-1.5 py-0.2 text-[10px] opacity-85">
                  {domainScored}/{domainItems.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {domains.map((domain) => (
            <section
              key={domain}
              id={`domain-${domain.replace(/\s+/g, "-")}`}
              className="scroll-mt-36 rounded-xl border border-paper-line-strong bg-paper/40 p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-paper-line-strong pb-2">
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0 font-bold text-base">
                  {domain}
                </h6>
                <span className="text-xs text-ink-faint">
                  {protocol.items.filter((i) => i.domain === domain && scores[i.id] !== undefined).length} de{" "}
                  {protocol.items.filter((i) => i.domain === domain).length} pontuados
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {protocol.items
                  .filter((i) => i.domain === domain)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-lg border border-paper-line-strong bg-paper/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="max-w-[460px]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink">{item.itemCode}</span>
                          {item.level && (
                            <span className="rounded-md bg-paper-line-strong px-2 py-0.5 text-xs text-ink-soft">
                              {item.level}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.description}</p>
                      </div>

                      {/* Seletores de Pontuação Otimizados para Toque (Tablet-Friendly, min-h 48px) */}
                      <div className="seg min-h-[48px] touch-manipulation self-start sm:self-center">
                        {values.map((value) => (
                          <label
                            key={value}
                            className="seg-opt min-h-[48px] min-w-[52px] touch-manipulation justify-center font-bold text-sm active:scale-95 transition-transform"
                          >
                            <input
                              type="radio"
                              name={`score-${item.id}`}
                              checked={scores[item.id] === value}
                              onChange={() => setScores((prev) => ({ ...prev, [item.id]: value }))}
                              className="sr-only"
                            />
                            {protocol.scale.labels[value]}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-paper-line-strong bg-paper/60 p-4">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3 font-semibold">
              Evolução por domínio
            </h6>
            {protocol.domainTrends.length === 0 ? (
              <p className="text-xs text-ink-faint">Ainda sem avaliações suficientes para comparar.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {protocol.domainTrends.map((trend) => (
                  <DomainTrendChart key={trend.domain} trend={trend} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-paper-line-strong bg-paper/60 p-4">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3 font-semibold">
              Histórico de avaliações
            </h6>
            {protocol.assessments.length === 0 ? (
              <p className="text-xs text-ink-faint">Nenhuma avaliação aplicada ainda.</p>
            ) : (
              <ul className="m-0 flex flex-col gap-2 pl-0 text-xs text-ink-soft" style={{ listStyle: "none" }}>
                {[...protocol.assessments].reverse().map((a) => (
                  <li key={a.id} className="border-b border-paper-line-strong pb-1.5 last:border-0 last:pb-0">
                    <span className="font-semibold text-ink">{formatDate(a.assessedAt)}</span> · {a.assessedByName}
                    <div className="text-[11px] text-ink-faint">
                      {Object.keys(a.scores).length} de {totalItems} marcos pontuados
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Sticky Bottom Save Bar for Tablet Ergonomics */}
      <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-line-strong bg-paper/95 p-3.5 shadow-lg backdrop-blur-md sm:p-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-ink">
            {scoredCount} de {totalItems} marcos respondidos ({pct}%)
          </span>
          <span className="text-[11px] text-ink-faint">
            {success ? "Avaliação gravada com sucesso!" : error ? error : "Pronto para registrar avaliação de hoje"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-status-negative-text font-medium">{error}</p>}
          {success && (
            <p className="text-xs font-medium" style={{ color: "var(--status-realizada)" }}>
              ✓ Registrado!
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary min-h-[48px] px-6 text-sm font-semibold touch-manipulation active:scale-95 transition-transform"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Salvando…" : "Salvar avaliação de hoje"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProtocolAssessmentPanel({
  patientId,
  protocols,
  initialProtocolId,
}: {
  patientId: string;
  protocols: ProtocolTabData[];
  initialProtocolId?: string;
}) {
  const requestedMatch = initialProtocolId
    ? (protocols.find((p) => p.id === initialProtocolId || p.name === initialProtocolId) ?? null)
    : null;
  const initialId = requestedMatch?.id ?? protocols[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const selected = protocols.find((p) => p.id === selectedId) ?? null;

  if (protocols.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-ink-soft">
          Nenhum protocolo com marcos cadastrados e visíveis para você ainda. Peça ao gestor pra cadastrar
          os itens em Cadastros → Terapias.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {protocols.length > 1 && (
        <div className="seg w-fit" role="group" aria-label="Escolha o protocolo a aplicar">
          {protocols.map((p) => (
            <button
              key={p.id}
              type="button"
              className="seg-btn"
              aria-pressed={p.id === selectedId}
              onClick={() => setSelectedId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {selected && <AssessmentForm key={selected.id} patientId={patientId} protocol={selected} />}
    </div>
  );
}
