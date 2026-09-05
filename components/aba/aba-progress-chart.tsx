"use client";

interface GraphDataItem {
  date: string;
  sessionTitle: string;
  independentPct: number;
  promptPct: number;
  incorrectPct: number;
  totalTrials: number;
}

interface ABAProgressChartProps {
  chartData: GraphDataItem[];
  patientName?: string;
}

export function ABAProgressChart({ chartData, patientName = "Paciente" }: ABAProgressChartProps) {
  if (!chartData || chartData.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="text-3xl block mb-2">📊</span>
        <h4 className="font-bold text-slate-800 dark:text-slate-200">Sem dados de tentativas registrados</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          À medida que as tentativas DTT/NET forem salvas nas sessões do paciente, o gráfico de evolução gerará a curva de aprendizagem automatizada.
        </p>
      </div>
    );
  }

  const latestSession = chartData[chartData.length - 1];
  const avgIndependent = Math.round(
    chartData.reduce((acc, curr) => acc + curr.independentPct, 0) / chartData.length
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
      {/* Header do Gráfico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            📈 Métricas Clínicas ABA
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
            Curva de Aquisição de Habilidades — {patientName}
          </h3>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="text-right">
            <span className="text-slate-400 block">Média Independente</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
              {avgIndependent}%
            </span>
          </div>
          <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-4">
            <span className="text-slate-400 block">Última Sessão</span>
            <span className="text-slate-800 dark:text-slate-200 font-black text-sm">
              {latestSession.independentPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Representação da Curva de Evolução Visual */}
      <div className="space-y-3 pt-1">
        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>Sessões Anteriores</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            🏆 Meta de Mestria: ≥ 80% Independente
          </span>
        </div>

        {/* Barras de Desempenho por Sessão */}
        <div className="space-y-2">
          {chartData.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>{item.sessionTitle}</span>
                <span>
                  {item.independentPct}% ind. ({item.totalTrials} tent.)
                </span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex">
                {/* Porcentagem Independente */}
                <div
                  style={{ width: `${item.independentPct}%` }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Independente: ${item.independentPct}%`}
                />
                {/* Porcentagem com Dica */}
                <div
                  style={{ width: `${item.promptPct}%` }}
                  className="bg-amber-400 h-full transition-all duration-500"
                  title={`Com Ajuda: ${item.promptPct}%`}
                />
                {/* Porcentagem Incorreto */}
                <div
                  style={{ width: `${item.incorrectPct}%` }}
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Incorreto: ${item.incorrectPct}%`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Legenda das Cores */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span>Independente (Acerto)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span>Com Ajuda / Dica</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <span>Incorreto / Erro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
