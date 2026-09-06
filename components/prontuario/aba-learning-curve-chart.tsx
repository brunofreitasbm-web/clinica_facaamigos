"use client";

import { useState } from "react";

export interface ProgramTrialSummary {
  id: string;
  programName: string;
  domain: string;
  masteryCriterion: string;
  status: "em_aquisicao" | "dominado" | "nao_iniciado";
  sessions: {
    date: string;
    totalTrials: number;
    correctIndependent: number;
    withPrompt: number;
    incorrect: number;
  }[];
}

export function AbaLearningCurveChart({
  programsData,
}: {
  programsData: ProgramTrialSummary[];
}) {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    programsData[0]?.id ?? ""
  );

  const selectedProgram =
    programsData.find((p) => p.id === selectedProgramId) ?? programsData[0];

  if (!selectedProgram) {
    return (
      <p className="text-sm text-ink-faint">
        Nenhuma tentativa de programa ABA registrada ainda para este paciente.
      </p>
    );
  }

  // Cálculos para o gráfico SVG
  const chartHeight = 220;
  const chartWidth = 550;
  const padding = 40;

  const points = selectedProgram.sessions.map((s, idx) => {
    const pct = Math.round((s.correctIndependent / s.totalTrials) * 100);
    const stepX =
      selectedProgram.sessions.length > 1
        ? (chartWidth - padding * 2) / (selectedProgram.sessions.length - 1)
        : 0;
    const x = padding + idx * stepX;
    const y = chartHeight - padding - (pct / 100) * (chartHeight - padding * 2);
    return { x, y, pct, date: s.date, session: s };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Última sessão realizada
  const lastSession = selectedProgram.sessions[selectedProgram.sessions.length - 1];
  const lastPct = lastSession
    ? Math.round((lastSession.correctIndependent / lastSession.totalTrials) * 100)
    : 0;

  const totalTrialsCount = selectedProgram.sessions.reduce(
    (acc, cur) => acc + cur.totalTrials,
    0
  );

  return (
    <div className="space-y-6">
      {/* Seleção do Programa ABA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">
            Curva de Aprendizado ABA (`trial_data`)
          </h3>
          <p className="text-xs text-ink-soft">
            Evolução de aquisição de habilidades por tentativa em cada programa ativo.
          </p>
        </div>

        <select
          value={selectedProgramId}
          onChange={(e) => setSelectedProgramId(e.target.value)}
          className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-sm font-medium text-ink shadow-sm focus:outline-none"
        >
          {programsData.map((p) => (
            <option key={p.id} value={p.id}>
              {p.programName}
            </option>
          ))}
        </select>
      </div>

      {/* Resumo do Programa Selecionado */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-paper-line bg-paper p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-soft uppercase tracking-wide">
            Taxa de Acertos (Última Sessão)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{lastPct}%</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Independente
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {lastSession?.correctIndependent} acertos em {lastSession?.totalTrials} tentativas
          </p>
        </div>

        <div className="rounded-lg border border-paper-line bg-paper p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-soft uppercase tracking-wide">
            Critério de Domínio
          </span>
          <p className="mt-1 text-sm font-semibold text-ink">
            {selectedProgram.masteryCriterion}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              selectedProgram.status === "dominado"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {selectedProgram.status === "dominado"
              ? "✓ Dominado / Alcançado"
              : "⟳ Em Aquisição"}
          </span>
        </div>

        <div className="rounded-lg border border-paper-line bg-paper p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-soft uppercase tracking-wide">
            Total de Tentativas Coletadas
          </span>
          <p className="mt-1 text-2xl font-bold text-ink">{totalTrialsCount}</p>
          <p className="mt-1 text-xs text-ink-faint">
            em {selectedProgram.sessions.length} sessões registradas
          </p>
        </div>
      </div>

      {/* Gráfico Vetorial SVG */}
      <div className="rounded-lg border border-paper-line bg-paper p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">
            Evolução da Porcentagem de Acertos Independente por Sessão
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              Acertos Independentes (%)
            </span>
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span className="h-0.5 w-4 bg-amber-500 border-t border-dashed"></span>
              Meta de Domínio (80%)
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto min-w-[500px]"
          >
            {/* Grid Horizontal */}
            {[0, 25, 50, 75, 100].map((val) => {
              const y =
                chartHeight - padding - (val / 100) * (chartHeight - padding * 2);
              return (
                <g key={val}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={chartWidth - padding}
                    y2={y}
                    stroke="currentColor"
                    className="text-paper-line-strong/60"
                    strokeDasharray={val === 80 ? "4 4" : "1 2"}
                    strokeWidth={val === 80 ? 1.5 : 1}
                  />
                  <text
                    x={padding - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-ink-faint text-[10px]"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Linha Meta 80% */}
            <line
              x1={padding}
              y1={chartHeight - padding - 0.8 * (chartHeight - padding * 2)}
              x2={chartWidth - padding}
              y2={chartHeight - padding - 0.8 * (chartHeight - padding * 2)}
              stroke="var(--color-accent-2)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Linha de Conexão do Gráfico */}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--color-teal)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePoints}
              />
            )}

            {/* Pontos no Gráfico */}
            {points.map((pt, idx) => (
              <g key={idx} className="group cursor-pointer">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  className="fill-emerald-500 stroke-paper stroke-2 group-hover:r-7 transition-all"
                />
                {/* Rótulo de Porcentagem acima do Ponto */}
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  className="fill-ink font-semibold text-[11px]"
                >
                  {pt.pct}%
                </text>
                {/* Rótulo de Data no Eixo X */}
                <text
                  x={pt.x}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  className="fill-ink-soft text-[10px]"
                >
                  {pt.date}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Detalhamento por Sessão */}
        <div className="border-t border-paper-line pt-4">
          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-3">
            Histórico Detalhado de Tentativas
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {selectedProgram.sessions.map((s, i) => (
              <div
                key={i}
                className="rounded-md border border-paper-line bg-paper-subtle p-2.5 text-xs space-y-1"
              >
                <div className="flex justify-between font-medium text-ink">
                  <span>Data: {s.date}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {Math.round((s.correctIndependent / s.totalTrials) * 100)}%
                  </span>
                </div>
                <div className="text-ink-soft space-y-0.5 text-[11px]">
                  <p>✓ Independente: {s.correctIndependent}</p>
                  <p>🤝 Com Ajuda: {s.withPrompt}</p>
                  <p>✕ Incorreto: {s.incorrect}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
