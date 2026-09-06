"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InteligenciaMetrics } from "../data";

interface InteligenciaClientProps {
  initialMetrics: InteligenciaMetrics;
  clinicId: string;
  currentPeriodKey: string;
}

export function InteligenciaClient({ initialMetrics, currentPeriodKey }: InteligenciaClientProps) {
  const router = useRouter();
  const [metrics] = useState<InteligenciaMetrics>(initialMetrics);
  const [activeTab, setActiveTab] = useState<"visao_geral" | "aniversariantes">("visao_geral");
  const [selectedSubMenu, setSelectedSubMenu] = useState<string>("visao_geral");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [activeCardMenu, setActiveCardMenu] = useState<number | null>(null);

  // Período selecionado
  const PERIOD_LABELS: Record<string, string> = {
    month: "06/08 - 05/09 (Mês Atual)",
    "30days": "Últimos 30 Dias",
    prev_month: "Mês Anterior",
  };

  const selectedPeriodLabel = PERIOD_LABELS[currentPeriodKey] || "06/08 - 05/09";

  // Função para mudar o período via navegação de rotas
  const handleSelectPeriod = (periodKey: string) => {
    setDateFilterOpen(false);
    router.push(`/gestor/inteligencia?period=${periodKey}`);
  };

  // Exportar dados do card em CSV
  const handleExportCardData = (cardTitle: string, dataObj: unknown) => {
    setActiveCardMenu(null);
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `${cardTitle.toLowerCase().replace(/\s+/g, "_")}_metricas.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Cálculos para o gráfico de rosca (SVG Donut)
  const donutItems = metrics.statusDonut;
  const totalDonut = metrics.statusTotalCount || metrics.totalAppointments || 0;

  let accumulatedAngle = 0;
  const slices = donutItems.map((item) => {
    const pct = totalDonut > 0 ? item.count / totalDonut : 0;
    const angle = pct * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;

    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(pct * circumference).toFixed(2)} ${(circumference * (1 - pct)).toFixed(2)}`;
    const strokeDashoffset = -((startAngle / 360) * circumference).toFixed(2);

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-paper">
      {/* Sidebar Lateral de Inteligência (TOTALMENTE CONECTADA) */}
      <aside className="w-64 border-r border-slate-200 bg-white p-5 text-slate-700">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">Inteligência</h2>

        <div className="mb-6">
          <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">VISÃO GERAL</p>
          <button
            onClick={() => {
              setSelectedSubMenu("visao_geral");
              setActiveTab("visao_geral");
            }}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedSubMenu === "visao_geral"
                ? "bg-slate-100 font-semibold text-slate-900"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Visão Geral
          </button>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">ATENDIMENTOS</p>
          <Link
            href="/gestor/dashboard"
            onClick={() => setSelectedSubMenu("atendimentos")}
            className={`block w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors no-underline ${
              selectedSubMenu === "atendimentos"
                ? "bg-slate-100 font-semibold text-slate-900"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Atendimentos (Painel Operacional) ↗
          </Link>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">FINANCEIRO</p>
          <nav className="flex flex-col gap-1">
            {[
              { id: "fin_panorama", label: "Panorama da Clínica", href: "/gestor/financeiro" },
              { id: "fin_cobrancas", label: "Cobranças e Inadimplência", href: "/gestor/financeiro?tab=glosas" },
              { id: "fin_extrato", label: "Extrato de Pagamentos", href: "/gestor/financeiro?tab=repasse" },
              { id: "fin_recebiveis", label: "Recebíveis", href: "/gestor/financeiro" },
              { id: "fin_documentos", label: "Documentos", href: "/gestor/cadastros" },
            ].map((sub) => (
              <Link
                key={sub.id}
                href={sub.href}
                onClick={() => setSelectedSubMenu(sub.id)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors rounded-md no-underline ${
                  selectedSubMenu === sub.id
                    ? "bg-slate-100 font-semibold text-slate-900"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {sub.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-8">
        {/* Topo / Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">VISÃO GERAL</p>
            <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
          </div>

          {/* Seletor / Filtro de Data em Tag Interativa */}
          <div className="relative">
            <button
              onClick={() => setDateFilterOpen(!dateFilterOpen)}
              className="flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 shadow-xs"
            >
              <span className="text-slate-400">+ Data</span>
              <span className="rounded bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                {selectedPeriodLabel}
              </span>
              <span className="text-slate-400 hover:text-slate-600">✕</span>
            </button>

            {dateFilterOpen && (
              <div className="absolute right-0 top-10 z-20 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 py-1 text-xs font-bold text-slate-400 uppercase">SELECIONE O PERÍODO</p>
                {[
                  { label: "06/08 - 05/09 (Mês Atual)", key: "month" },
                  { label: "Últimos 30 Dias", key: "30days" },
                  { label: "Mês Anterior", key: "prev_month" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleSelectPeriod(item.key)}
                    className={`w-full text-left px-2 py-2 text-xs rounded transition-colors ${
                      currentPeriodKey === item.key
                        ? "bg-indigo-50 font-bold text-indigo-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="mb-6 flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("visao_geral")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "visao_geral"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab("aniversariantes")}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "aniversariantes"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Aniversariantes
            {metrics.aniversariantes.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                {metrics.aniversariantes.length}
              </span>
            )}
          </button>
        </div>

        {/* ABA: VISÃO GERAL */}
        {activeTab === "visao_geral" && (
          <div className="space-y-6">
            {/* Linha 1: Cards Principais de Indicadores (4 colunas) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Total de Atendimentos */}
              <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>📅 Total de Atendimentos</span>
                  <button
                    onClick={() => setActiveCardMenu(activeCardMenu === 1 ? null : 1)}
                    className="text-slate-300 hover:text-slate-600"
                  >
                    •••
                  </button>
                </div>

                {activeCardMenu === 1 && (
                  <div className="absolute right-3 top-9 z-10 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-md">
                    <button
                      onClick={() => handleExportCardData("Total de Atendimentos", { total: metrics.totalAppointments, growth: metrics.growthPct })}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Exportar Dados (JSON)
                    </button>
                  </div>
                )}

                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                    {metrics.totalAppointments.toLocaleString("pt-BR")}
                  </span>
                  <p className="mt-1 text-xs text-slate-400">período selecionado</p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <span>↑ {metrics.growthPct}%</span>
                  <span className="font-normal text-slate-400">vs. período anterior: {metrics.prevMonthAppointments}</span>
                </div>
              </div>

              {/* Card 2: Total de Cobranças */}
              <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>🟡 Total de Cobranças</span>
                  <button
                    onClick={() => setActiveCardMenu(activeCardMenu === 2 ? null : 2)}
                    className="text-slate-300 hover:text-slate-600"
                  >
                    •••
                  </button>
                </div>

                {activeCardMenu === 2 && (
                  <div className="absolute right-3 top-9 z-10 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-md">
                    <button
                      onClick={() => handleExportCardData("Total de Cobranças", { cobrancas: metrics.totalCobrancas })}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Exportar Dados (JSON)
                    </button>
                  </div>
                )}

                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                    {metrics.totalCobrancas}
                  </span>
                  <p className="mt-1 text-xs text-slate-400">guias / faturas emitidas</p>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {metrics.totalCobrancas > 0 ? "Cobranças ativas no período" : "Nenhuma alteração"}
                </p>
              </div>

              {/* Card 3: Valor Total das Cobranças */}
              <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>🪙 Valor Total das Cobranças</span>
                  <button
                    onClick={() => setActiveCardMenu(activeCardMenu === 3 ? null : 3)}
                    className="text-slate-300 hover:text-slate-600"
                  >
                    •••
                  </button>
                </div>

                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                    R${metrics.valorTotalCobrancas.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </span>
                  <p className="mt-1 text-xs text-slate-400">faturamento consolidado</p>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {metrics.valorTotalCobrancas > 0 ? "Consolidado do período" : "Nenhuma alteração"}
                </p>
              </div>

              {/* Card 4: Valor Recebido */}
              <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>🪙 Valor Recebido (cobrança...)</span>
                  <button
                    onClick={() => setActiveCardMenu(activeCardMenu === 4 ? null : 4)}
                    className="text-slate-300 hover:text-slate-600"
                  >
                    •••
                  </button>
                </div>

                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                    R${metrics.valorRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </span>
                  <p className="mt-1 text-xs text-slate-400">liquidado em conta</p>
                </div>
                <p className="mt-3 text-xs font-semibold text-emerald-600">
                  {metrics.valorRecebido > 0 ? "Recebimentos confirmados" : "Nenhuma alteração"}
                </p>
              </div>
            </div>

            {/* Linha 2: Gráficos de Status (4 colunas) - CONECTADOS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 5: Atendimento por Status (SVG Donut Chart) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Atendimento por Status</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="space-y-2 text-xs font-medium">
                    {donutItems.map((item) => (
                      <div key={item.status} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600">{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="relative flex items-center justify-center">
                    <svg width="110" height="110" viewBox="0 0 100 100" className="-rotate-90">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-paper-line)" strokeWidth="16" />
                      {slices.map((slice) => (
                        <circle
                          key={slice.status}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth="16"
                          strokeDasharray={slice.strokeDasharray}
                          strokeDashoffset={slice.strokeDashoffset}
                        />
                      ))}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-sm font-extrabold text-slate-900">
                        {totalDonut.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Total</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 6: Número de Cobranças por Status (CONECTADO) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between min-h-[160px]">
                <div className="w-full flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Número de Cobranças por Status</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                {metrics.cobrancasPorStatus.some((c) => c.count > 0) ? (
                  <div className="space-y-2 py-2">
                    {metrics.cobrancasPorStatus.map((item) => (
                      <div key={item.statusKey} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600">{item.label}</span>
                        </div>
                        <span className="font-bold text-slate-800">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center text-center">
                    <div className="text-3xl text-slate-300 mb-1">⛵</div>
                    <p className="text-xs text-slate-400 font-medium">Nenhum resultado</p>
                  </div>
                )}
              </div>

              {/* Card 7: Valor Cobranças por Status (CONECTADO) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between min-h-[160px]">
                <div className="w-full flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Valor Cobranças por Status</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                {metrics.cobrancasPorStatus.some((c) => c.amount > 0) ? (
                  <div className="space-y-2 py-2">
                    {metrics.cobrancasPorStatus.map((item) => (
                      <div key={item.statusKey} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600">{item.label}</span>
                        </div>
                        <span className="font-bold text-slate-800">
                          R${item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center text-center">
                    <div className="text-3xl text-slate-300 mb-1">⛵</div>
                    <p className="text-xs text-slate-400 font-medium">Nenhum resultado</p>
                  </div>
                )}
              </div>

              {/* Card 8: Valor a Receber Pendente */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Valor a Receber Pendente</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                <div className="my-auto py-6">
                  <span className="text-4xl font-extrabold text-slate-800 tracking-tight">
                    R${metrics.valorPendente.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Linha 3: Histórico de Atendimento por Semana (4 colunas) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 9: Atendimento por Semana */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>📅 Atendimento por Seman...</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>

                <div className="mt-6 flex items-end justify-between gap-2 h-32 px-2">
                  {metrics.weeklyVolume.map((w, idx) => {
                    const maxVal = Math.max(...metrics.weeklyVolume.map((item) => item.count), 1);
                    const barHeightPct = Math.max(15, Math.min(100, (w.count / maxVal) * 100));

                    return (
                      <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-1 h-full">
                        <span className="text-[11px] font-bold text-slate-700">{w.count}</span>
                        <div
                          className="w-full rounded-t bg-emerald-500 hover:bg-emerald-600 transition-all"
                          style={{ height: `${barHeightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400 px-1 border-t border-slate-100 pt-1">
                  <span>Período Inicial</span>
                  <span>Período Final</span>
                </div>
              </div>

              {/* Card 10: Cobranças por Status por Semana (CONECTADO) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between min-h-[160px]">
                <div className="w-full flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Cobranças por Status por Se...</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                {metrics.weeklyBillingVolume.some((w) => w.paidCount > 0 || w.pendingCount > 0) ? (
                  <div className="mt-4 flex items-end justify-between gap-2 h-28 px-1">
                    {metrics.weeklyBillingVolume.map((w, idx) => (
                      <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-1 h-full">
                        <div className="w-full flex flex-col gap-0.5 items-center justify-end h-full">
                          <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.min(100, w.paidCount * 10)}%` }} />
                          <div className="w-full rounded-b bg-amber-400" style={{ height: `${Math.min(100, w.pendingCount * 10)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center text-center">
                    <div className="text-3xl text-slate-300 mb-1">⛵</div>
                    <p className="text-xs text-slate-400 font-medium">Nenhum resultado</p>
                  </div>
                )}
              </div>

              {/* Card 11: Valor das Cobranças por Status (CONECTADO) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between min-h-[160px]">
                <div className="w-full flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Valor das Cobranças por Sta...</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                {metrics.weeklyBillingVolume.some((w) => w.paidAmount > 0 || w.pendingAmount > 0) ? (
                  <div className="space-y-1.5 py-2 text-xs">
                    <div className="flex justify-between font-semibold text-emerald-700">
                      <span>Liquidado:</span>
                      <span>R${metrics.valorRecebido.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-amber-700">
                      <span>Pendente:</span>
                      <span>R${metrics.valorPendente.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center text-center">
                    <div className="text-3xl text-slate-300 mb-1">⛵</div>
                    <p className="text-xs text-slate-400 font-medium">Nenhum resultado</p>
                  </div>
                )}
              </div>

              {/* Card 12: Valor a Receber por Status (CONECTADO) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between min-h-[160px]">
                <div className="w-full flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Valor a Receber por Status</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                <div className="my-auto py-2">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-slate-800">
                      R${metrics.valorPendente.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Total Pendente de Faturamento</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 4: Métricas Gerais (4 colunas) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 13: Pacientes Ativos */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Pacientes Ativos</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                <div className="mt-4 text-center">
                  <span className="text-4xl font-extrabold text-slate-900 tabular-nums">
                    {metrics.pacientesAtivos}
                  </span>
                </div>
              </div>

              {/* Card 14: Número de Terapeutas */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Número de Terapeutas</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                <div className="mt-4 text-center">
                  <span className="text-4xl font-extrabold text-slate-900 tabular-nums">
                    {metrics.equipeCount}
                  </span>
                </div>
              </div>

              {/* Card 15: Economizadas no período */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>📊 Economizadas no período</span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                <div className="mt-4 text-center">
                  <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                    {metrics.horasEconomizadas} horas
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: ANIVERSARIANTES */}
        {activeTab === "aniversariantes" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="mb-4 text-base font-bold text-slate-900">Aniversariantes do Mês</h3>
            {metrics.aniversariantes.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.aniversariantes.map((aniv) => (
                  <div
                    key={aniv.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-indigo-50/50 hover:border-indigo-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 font-bold text-white shadow-xs">
                        {aniv.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{aniv.name}</h4>
                        <p className="text-xs text-slate-500">
                          {aniv.type === "paciente" ? "Paciente" : "Equipe"}{" "}
                          {aniv.age ? `• ${aniv.age} anos` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-md bg-white border border-slate-200 px-2 py-1 text-xs font-bold text-indigo-600 shadow-2xs">
                        🎂 {aniv.formattedDate}
                      </span>
                      <Link
                        href={`/gestor/integracoes/whatsapp?contact=${encodeURIComponent(aniv.name)}`}
                        className="text-[11px] font-semibold text-emerald-600 hover:underline"
                      >
                        Enviar Parabéns 💬
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <p className="text-lg">🎂 Sem aniversariantes cadastrados neste mês.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
