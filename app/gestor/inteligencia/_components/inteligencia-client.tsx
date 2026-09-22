"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InteligenciaMetrics } from "../data";
import { formatMetricValue } from "@/lib/metric-catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/page-container";

function formatPlural(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

interface InteligenciaClientProps {
  initialMetrics: InteligenciaMetrics;
  clinicId: string;
  currentPeriodKey: string;
}

export function InteligenciaClient({ initialMetrics, currentPeriodKey }: InteligenciaClientProps) {
  const router = useRouter();
  const [metrics] = useState<InteligenciaMetrics>(initialMetrics);
  const [activeTab, setActiveTab] = useState<"visao_geral" | "funil" | "equipe" | "salas" | "aniversariantes">("visao_geral");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [activeCardMenu, setActiveCardMenu] = useState<number | null>(null);
  const [capacityPeriod, setCapacityPeriod] = useState<"manha" | "tarde" | "dia" | "semana" | "mes">("semana");

  // Período selecionado
  const PERIOD_LABELS: Record<string, string> = {
    month: "06/08 - 05/09 (Mês Atual)",
    "30days": "Últimos 30 Dias",
    prev_month: "Mês Anterior",
  };

  const selectedPeriodLabel = PERIOD_LABELS[currentPeriodKey] || "06/08 - 05/09";

  const handleSelectPeriod = (periodKey: string) => {
    setDateFilterOpen(false);
    router.push(`/gestor/inteligencia?period=${periodKey}`);
  };

  const handleClearDateFilter = () => {
    router.push("/gestor/inteligencia?period=month");
  };

  const emptyStateAction =
    currentPeriodKey !== "month"
      ? { label: "Limpar filtro de data", onClick: handleClearDateFilter }
      : undefined;

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

  // Gráfico Donut SVG para Atendimentos por Status
  const donutItems = metrics.statusDonut;
  const totalDonut = metrics.statusTotalCount || metrics.totalAppointments || 0;

  const slices = useMemo(() => {
    return donutItems.map((item, idx) => {
      const pct = totalDonut > 0 ? item.count / totalDonut : 0;
      const previousPctSum = donutItems
        .slice(0, idx)
        .reduce((sum, prev) => sum + (totalDonut > 0 ? prev.count / totalDonut : 0), 0);
      const startAngle = previousPctSum * 360;

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
  }, [donutItems, totalDonut]);

  return (
    <PageContainer className="bg-paper">
      {/* Topo / Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">INTELICÊNCIA BI & CLINICAL DASHBOARD</p>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral Operacional</h1>
        </div>

        {/* Seletor de Período */}
        <div className="relative">
          <button
            onClick={() => setDateFilterOpen(!dateFilterOpen)}
            className="flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 shadow-xs"
          >
            <span className="text-slate-400">+ Período</span>
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
          onClick={() => setActiveTab("funil")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "funil"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Funil
          {metrics.onboardingFunnel.pipelineNow.stuck3d > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
              {metrics.onboardingFunnel.pipelineNow.stuck3d}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("equipe")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "equipe"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Equipe
          {metrics.teamProductivity.rows.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
              {metrics.teamProductivity.rows.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("salas")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "salas"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Salas
          {metrics.roomRanking.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
              {metrics.roomRanking.length}
            </span>
          )}
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
          {/* Linha 1: Cards Principais de Indicadores Operacionais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Total de Atendimentos */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span>📅 Total de Atendimentos</span>
                <button
                  onClick={() => setActiveCardMenu(activeCardMenu === 1 ? null : 1)}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
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
                <p className="mt-1 text-xs text-slate-600">período selecionado</p>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span>↑ {metrics.growthPct}%</span>
                <span className="font-normal text-slate-600">vs. período anterior ({metrics.prevMonthAppointments})</span>
              </div>
            </div>

            {/* Card 2: Agendamentos via WhatsApp */}
            <div className="relative rounded-xl border border-indigo-100 bg-linear-to-br from-indigo-50/50 to-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5 font-bold text-indigo-800">
                  <span className="text-sm">💬</span> Primeiros Agendamentos WhatsApp
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                  {metrics.whatsappStat.whatsappPct}% (Meta ≥ 70%)
                </span>
              </div>

              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {metrics.whatsappStat.whatsappCount}
                </span>
                <p className="mt-1 text-xs text-slate-600">
                  de {metrics.whatsappStat.totalFirstAppointments} novos cadastros no período
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-indigo-600">
                <span>Entrada via bot WhatsApp</span>
                <span className={metrics.whatsappStat.whatsappPct >= 70 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                  {metrics.whatsappStat.whatsappPct >= 70 ? "✓ No Alvo" : "⚠️ Requer Ajuste"}
                </span>
              </div>
            </div>

            {/* Card 3: Pacientes Novos por Semana */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span>📈 Pacientes Novos por Semana</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  Entradas
                </span>
              </div>

              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  +{metrics.newPatientsWeekly.reduce((sum, w) => sum + w.newCount, 0)}
                </span>
                <p className="mt-1 text-xs text-slate-600">novos pacientes no período</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Média: {(metrics.newPatientsWeekly.reduce((sum, w) => sum + w.newCount, 0) / Math.max(1, metrics.newPatientsWeekly.length)).toFixed(1)} / sem</span>
                <span className="font-semibold text-emerald-600">Meta: ≥ 3/sem</span>
              </div>
            </div>

            {/* Card 4: Pacientes Evadidos */}
            <div className="relative rounded-xl border border-rose-100 bg-linear-to-br from-rose-50/40 to-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span className="font-bold text-rose-800 flex items-center gap-1">
                  <span>⚠️</span> Pacientes Evadidos
                </span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">
                  {metrics.evadedPatientsStat.evadedRatePct}% (Meta &lt; 5%)
                </span>
              </div>

              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {metrics.evadedPatientsStat.totalEvaded}
                </span>
                <p className="mt-1 text-xs text-slate-600">pacientes inativos / desligados</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-rose-700">
                <span>Acompanhamento pós-tratamento</span>
                <span className={metrics.evadedPatientsStat.evadedRatePct <= 5 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                  {metrics.evadedPatientsStat.evadedRatePct <= 5 ? "✓ Saudável" : "⚠️ Taxa Alta"}
                </span>
              </div>
            </div>
          </div>

          {/* Linha 2: Monitoramento Operacional Tempo Real e Fluxo de Check-in */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* QUADRO 2: Salas em Tempo Real (Top 8 salas com atendimentos agora) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span className="font-bold text-slate-900 text-sm">Salas em Tempo Real</span>
                  <span className="text-[10px] text-slate-400">(Top 8 salas em atendimento agora)</span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Ao vivo
                </span>
              </div>

              {metrics.liveRooms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
                  {metrics.liveRooms.map((room) => {
                    const statusBadge =
                      room.occupancyStatus === "lotada"
                        ? "bg-rose-100 text-rose-800 border-rose-200"
                        : room.occupancyStatus === "movimentada"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200";

                    return (
                      <div
                        key={room.roomId}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{room.roomName}</p>
                          <p className="text-[11px] text-slate-500">Capacidade: {room.capacity} criança(s)</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                            {room.activePatientsCount} em atendimento
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Sem sessões ativas no exato momento.
                </div>
              )}
            </div>

            {/* QUADRO 1: Fluxo de Pacientes por Horário (08:00 às 18:00) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 mb-2">
                <span className="font-bold text-slate-900 text-sm">⏰ Fluxo de Check-ins por Horário (08h às 18h)</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  🔥 Pico: {metrics.peakHourLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Concentração de chegadas de pacientes na recepção para as sessões</p>

              <div className="flex items-end justify-between gap-1 h-36 px-1 pt-2">
                {metrics.hourlyFlow.map((h) => {
                  const maxVal = Math.max(...metrics.hourlyFlow.map((i) => i.checkinCount), 1);
                  const barHeightPct = Math.max(10, Math.min(100, (h.checkinCount / maxVal) * 100));

                  return (
                    <div key={h.hour} className="flex flex-1 flex-col items-center justify-end gap-1 h-full">
                      <span className={`text-[10px] font-bold ${h.isPeak ? "text-amber-600 scale-110" : "text-slate-600"}`}>
                        {h.checkinCount}
                      </span>
                      <div
                        className={`w-full rounded-t transition-all ${
                          h.isPeak ? "bg-amber-500 shadow-xs" : "bg-indigo-500 hover:bg-indigo-600"
                        }`}
                        style={{ height: `${barHeightPct}%` }}
                        title={`${h.label}: ${h.checkinCount} check-ins`}
                      />
                      <span className={`text-[10px] font-medium mt-1 ${h.isPeak ? "font-bold text-amber-700" : "text-slate-500"}`}>
                        {h.label.split(":")[0]}h
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Linha 3: Mapa de Calor + Pacientes por Plano de Saúde */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Mapa de Calor Dia × Hora — versão ultra compacta sem rolagem */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between overflow-hidden">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">🗓️ Mapa de Calor · Ocupação</span>
                    {metrics.weekHourHeatmap.idleWindows.length > 0 && (
                      <span
                        className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-800 border border-amber-200/60 max-w-full truncate"
                        title={`Encaixes vagos: ${metrics.weekHourHeatmap.idleWindows.map((w) => w.label).join(", ")}`}
                      >
                        Encaixes:{" "}
                        {metrics.weekHourHeatmap.idleWindows.length <= 2
                          ? metrics.weekHourHeatmap.idleWindows.map((w) => w.label).join(", ")
                          : `${metrics.weekHourHeatmap.idleWindows.slice(0, 2).map((w) => w.label).join(", ")} +${metrics.weekHourHeatmap.idleWindows.length - 2}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-0.5">
                      <span className="h-2 w-2 rounded-xs bg-indigo-100 border border-indigo-200" /> Baixo
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="h-2 w-2 rounded-xs bg-indigo-600" /> Pico
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="h-2 w-2 rounded-xs bg-amber-50 ring-1 ring-amber-400" /> Ocioso
                    </span>
                  </div>
                </div>

                <div className="w-full min-w-0">
                  <div
                    className="grid gap-0.5 sm:gap-1 w-full"
                    style={{ gridTemplateColumns: `24px repeat(${metrics.weekHourHeatmap.hours.length}, minmax(0,1fr))` }}
                  >
                    <div />
                    {metrics.weekHourHeatmap.hours.map((h) => (
                      <div key={h} className="text-center text-[8.5px] sm:text-[9px] font-semibold text-slate-400 truncate">
                        {h}h
                      </div>
                    ))}
                    {metrics.weekHourHeatmap.dayLabels.map((day) => (
                      <Fragment key={day.dow}>
                        <div className="flex items-center text-[9px] sm:text-[10px] font-semibold text-slate-600 truncate">
                          {day.label}
                        </div>
                        {metrics.weekHourHeatmap.cells
                          .filter((c) => c.dow === day.dow)
                          .map((cell) => (
                            <div
                              key={`${cell.dow}-${cell.hour}`}
                              title={`${day.label} ${String(cell.hour).padStart(2, "0")}h: ${cell.count} sessão(ões)`}
                              className={`h-4.5 sm:h-5 rounded-xs flex items-center justify-center text-[8.5px] sm:text-[9px] font-bold transition-all hover:scale-110 hover:z-10 cursor-pointer ${
                                cell.isIdle ? "ring-1 ring-amber-400 bg-amber-50/50" : ""
                              }`}
                              style={{
                                backgroundColor: cell.isIdle
                                  ? undefined
                                  : `rgba(79,70,229,${(0.1 + 0.82 * cell.intensity).toFixed(2)})`,
                                color: cell.intensity > 0.5 ? "#ffffff" : "#312e81",
                              }}
                            >
                              {cell.count > 0 ? cell.count : ""}
                            </div>
                          ))}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[9px] sm:text-[10px] text-slate-400">
                Cor mais forte = maior volume de sessões; borda âmbar = sem sessões no horário.
              </p>
            </div>

            {/* QUADRO 4: Pacientes por Plano de Saúde / Convênio */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 mb-3">
                <span className="font-bold text-slate-900 text-sm">🏥 Pacientes por Plano de Saúde</span>
                <span className="text-xs font-semibold text-slate-500">Total: {metrics.pacientesAtivos}</span>
              </div>

              <div className="space-y-3 py-1">
                {metrics.patientsByInsurer.map((ins) => (
                  <div key={ins.insurerId} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">{ins.insurerName}</span>
                      <span className="font-bold text-slate-700">{ins.patientCount} pacientes ({ins.percentage}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${Math.max(4, ins.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Linha 4: Faturamento por Convênio + Atendimento por Status */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* QUADRO 5: Plano de Saúde por Faturamento + Concentração */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 mb-3">
                <span className="font-bold text-slate-900 text-sm">🪙 Plano de Saúde por Faturamento</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    metrics.insurerConcentration.riskLevel === "alta"
                      ? "text-rose-700 bg-rose-50"
                      : metrics.insurerConcentration.riskLevel === "media"
                        ? "text-amber-700 bg-amber-50"
                        : "text-emerald-700 bg-emerald-50"
                  }`}
                >
                  Top 3 = {metrics.insurerConcentration.top3SharePct}%
                </span>
              </div>

              <div className="space-y-3 py-1">
                {metrics.revenueByInsurer.map((rev) => {
                  const conc = metrics.insurerConcentration.rows.find((r) => r.insurerId === rev.insurerId);
                  return (
                    <div key={rev.insurerId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{rev.insurerName}</span>
                        <span className="font-bold text-emerald-700 tabular-nums">
                          R${rev.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} ({rev.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max(4, rev.percentage)}%` }}
                        />
                      </div>
                      {conc?.ticketMedio != null && (
                        <p className="text-[11px] text-slate-400">
                          ticket médio: R${conc.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/sessão
                          {conc.glosado > 0 && ` · R$${conc.glosado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} em glosa`}
                        </p>
                      )}
                    </div>
                  );
                })}
                {metrics.revenueByInsurer.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">Sem cobranças de plano de saúde no período.</p>
                )}
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                Somente cobranças de plano de saúde (billing_items); atendimento particular não é faturado por este módulo.
              </p>
            </div>
          </div>

          {/* Linha 4: Tendência e Histórico de Sessões */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Card: Atendimento por Status (SVG Donut Chart) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span className="font-bold text-slate-900 text-sm">Atendimento por Status</span>
                <button className="shrink-0 text-slate-400 hover:text-slate-600">•••</button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="space-y-2 text-xs font-medium">
                  {donutItems.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-bold text-slate-800 ml-auto">({item.count})</span>
                    </div>
                  ))}
                </div>

                <div className="relative flex items-center justify-center">
                  <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
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
                    <span className="text-base font-extrabold text-slate-900">
                      {totalDonut.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium">Total Sessões</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Atendimento por Semana */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span className="font-bold text-slate-900 text-sm">📅 Atendimento por Semana</span>
                <span className="text-xs text-slate-500">{selectedPeriodLabel}</span>
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
              <div className="mt-2 flex justify-between gap-1 text-[10px] font-medium text-slate-600 px-1 border-t border-slate-100 pt-1">
                {metrics.weeklyVolume.map((w, idx) => (
                  <span key={idx} className="flex-1 truncate text-center" title={w.weekLabel}>
                    {w.weekLabel}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Linha 5: Métricas Gerais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span>Pacientes Ativos</span>
              </div>
              <div className="mt-3 text-center">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {metrics.pacientesAtivos}
                </span>
                <p className="text-xs text-slate-500 mt-1">Crianças em acompanhamento</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span>Número de Terapeutas</span>
              </div>
              <div className="mt-3 text-center">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {metrics.equipeCount}
                </span>
                <p className="text-xs text-slate-500 mt-1">Profissionais ativos na equipe</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
                <span>📊 Economizadas com Automações</span>
              </div>
              <div className="mt-3 text-center">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {formatPlural(metrics.horasEconomizadas, "hora", "horas")}
                </span>
                <p className="text-xs text-slate-500 mt-1">Otimização administrativa no período</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA: FUNIL */}
      {activeTab === "funil" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="mb-1 text-base font-bold text-slate-900">Funil de Onboarding</h3>
            <p className="mb-4 text-xs text-slate-500">
              Eventos ocorridos no período selecionado, em cada etapa do cadastro contínuo.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.onboardingFunnel.stages.map((stage, idx) => {
                const first = metrics.onboardingFunnel.stages[0]?.count ?? 0;
                const widthPct = first > 0 ? Math.max(6, Math.round((stage.count / first) * 100)) : 0;
                return (
                  <div key={stage.key} className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold text-slate-600">{stage.label}</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{stage.count}</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${widthPct}%` }} />
                    </div>
                    {idx > 0 && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        {stage.avgDaysFromPrev != null
                          ? `~${stage.avgDaysFromPrev} dia(s) desde a etapa anterior (${stage.samples} caso(s))`
                          : "sem dados suficientes no período"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="mb-1 text-base font-bold text-slate-900">Pipeline agora</h3>
            <p className="mb-4 text-xs text-slate-500">Situação atual de todos os pacientes ainda não ativos, independente do período selecionado.</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                { label: "Interessados", value: metrics.onboardingFunnel.pipelineNow.interessados },
                { label: "Aguardando avaliação", value: metrics.onboardingFunnel.pipelineNow.awaitingEvaluation },
                { label: "Avaliado sem guia", value: metrics.onboardingFunnel.pipelineNow.evaluatedNoGuide },
                { label: "Guia sem grade", value: metrics.onboardingFunnel.pipelineNow.authorizedNoGrid },
                { label: "Travados ≥ 3 dias", value: metrics.onboardingFunnel.pipelineNow.stuck3d, alert: true },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className={`rounded-lg border p-3 text-center ${
                    tile.alert ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50/70"
                  }`}
                >
                  <p className={`text-xl font-extrabold tabular-nums ${tile.alert ? "text-rose-700" : "text-slate-900"}`}>
                    {tile.value}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-600">{tile.label}</p>
                </div>
              ))}
            </div>
            {metrics.onboardingFunnel.pipelineNow.stuck3d > 0 && (
              <Link
                href="/recepcao/pacientes/pendencias"
                className="mt-4 inline-block text-xs font-semibold text-rose-700 hover:underline"
              >
                Ver pacientes travados →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ABA: EQUIPE */}
      {activeTab === "equipe" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-base font-bold text-slate-900">Produtividade por Terapeuta</h3>
              <span className="text-xs text-slate-500">{selectedPeriodLabel}</span>
            </div>
            {metrics.teamProductivity.rows.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                      <th className="px-5 py-2">Terapeuta</th>
                      <th className="px-5 py-2 text-right">Realizadas</th>
                      <th className="px-5 py-2 text-right">Faltas</th>
                      <th className="px-5 py-2 text-right">Cancel. &lt;24h</th>
                      <th className="px-5 py-2">Utilização</th>
                      <th className="px-5 py-2">Evolução 24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.teamProductivity.rows.map((row) => (
                      <tr key={row.therapistId} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-bold text-slate-900">{row.realized}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700">{row.noShows}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                          {row.therapistCancelRatePct != null ? `${row.therapistCancelRatePct}%` : "—"}
                        </td>
                        <td className="px-5 py-3">
                          {row.utilizationPct != null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${
                                    row.utilizationPct >= 85
                                      ? "bg-emerald-500"
                                      : row.utilizationPct >= 60
                                        ? "bg-amber-400"
                                        : "bg-rose-400"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(4, row.utilizationPct))}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">{row.utilizationPct}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">sem disponibilidade cadastrada</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {row.note24hRatePct != null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${row.note24hRatePct >= 98 ? "bg-emerald-500" : "bg-rose-400"}`}
                                  style={{ width: `${Math.min(100, Math.max(4, row.note24hRatePct))}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">{row.note24hRatePct}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <EmptyState
                  title="Sem sessões no período"
                  description="Nenhuma sessão de terapeuta encontrada para calcular produtividade."
                  action={emptyStateAction}
                />
              </div>
            )}
            <p className="px-5 py-4 text-[11px] text-slate-400">
              Utilização = horas realizadas ÷ disponibilidade cadastrada (Supervisão → Disponibilidade); mesma regra da métrica de PLR &ldquo;Utilização da disponibilidade dos terapeutas&rdquo;. Cancelamento &lt;24h conta apenas cancelamentos pelo terapeuta com menos de 24h de antecedência.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="mb-1 text-base font-bold text-slate-900">Metas PLR vs. Realizado (últimos 6 meses)</h3>
            <p className="mb-4 text-xs text-slate-500">
              Fechamentos mensais oficiais (metric_snapshots) comparados à meta cadastrada em cada cargo.
            </p>
            {metrics.plrTrend.rows.length > 0 ? (
              <div className="space-y-4">
                {metrics.plrTrend.rows.map((row) => (
                  <div key={`${row.role}-${row.metricKey}`} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900">{row.metricLabel}</span>
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          {row.role}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        meta: {row.direction === "max" ? "≤" : "≥"} {row.targetValue}
                        {row.unit === "pct" ? "%" : row.unit === "dias" ? " dias" : row.unit === "min" ? " min" : ""}
                      </span>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      {row.points.map((p) => {
                        const maxVal = Math.max(...row.points.map((pt) => pt.value ?? 0), 0.0001);
                        const heightPct = p.value != null ? Math.max(8, (p.value / maxVal) * 100) : 0;
                        return (
                          <div key={p.periodStart} className="flex flex-1 flex-col items-center gap-1">
                            <div className="flex h-14 w-full items-end">
                              {p.value != null ? (
                                <div
                                  className={`w-full rounded-t ${p.met ? "bg-emerald-500" : "bg-rose-400"}`}
                                  style={{ height: `${heightPct}%` }}
                                  title={`${p.periodLabel}: ${formatMetricValue(p.value, row.unit)}`}
                                />
                              ) : (
                                <div className="h-1 w-full self-end border-t border-dashed border-slate-300" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{p.periodLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sem metas cadastradas ou sem fechamento mensal ainda"
                description="Cadastre metas em /gestor/metas — a primeira linha aparece após o fechamento mensal (dia 1)."
              />
            )}
          </div>
        </div>
      )}

      {/* ABA: SALAS */}
      {activeTab === "salas" && (
        <div className="space-y-6">
          {/* Indicador em Destaque: Capacidade Operacional da Clínica */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold tracking-wider text-indigo-500 uppercase">Indicador em Destaque</span>
                <h3 className="text-base font-bold text-slate-900">Capacidade Operacional da Clínica</h3>
                <p className="text-xs text-slate-600">Ocupação combinada de todas as salas (exceto Sala de Avaliação)</p>
              </div>
              <div className="flex rounded-full border border-indigo-200 bg-white p-1 text-xs font-semibold">
                {metrics.clinicCapacity.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setCapacityPeriod(item.key)}
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      capacityPeriod === item.key
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:bg-indigo-50"
                    }`}
                  >
                    {item.key === "manha" && "Manhã"}
                    {item.key === "tarde" && "Tarde"}
                    {item.key === "dia" && "Dia"}
                    {item.key === "semana" && "Semana"}
                    {item.key === "mes" && "Mês"}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const selected = metrics.clinicCapacity.find((c) => c.key === capacityPeriod);
              if (!selected) return null;
              const barColor =
                selected.occupancyPct >= 80
                  ? "bg-rose-500"
                  : selected.occupancyPct >= 60
                    ? "bg-amber-400"
                    : "bg-emerald-500";
              return (
                <div className="mt-5 flex flex-wrap items-end gap-6">
                  <span className="text-5xl font-extrabold text-slate-900 tabular-nums">
                    {selected.occupancyPct}%
                  </span>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs text-slate-600">{selected.label}</p>
                    <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(2, selected.occupancyPct)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {selected.bookedHours}h ocupadas de {selected.availableHours}h disponíveis · {selected.roomsConsidered}{" "}
                      {selected.roomsConsidered === 1 ? "sala" : "salas"}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Alertas */}
          {metrics.roomCapacityAlerts.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <h3 className="text-sm font-bold text-rose-800">
                  Alerta de Capacidade — {metrics.roomCapacityAlerts.length}{" "}
                  {metrics.roomCapacityAlerts.length === 1 ? "sala" : "salas"} próxima(s) do limite
                </h3>
              </div>
              <div className="mt-3 space-y-2">
                {metrics.roomCapacityAlerts.map((alert) => (
                  <div
                    key={`${alert.roomId}-${alert.shift}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-white p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {alert.roomName} · {alert.shiftLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">{alert.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
                      {alert.occupancyPct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards resumo salas */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-medium text-slate-600">🏆 Sala mais utilizada</span>
              <div className="mt-3">
                <span className="text-xl font-extrabold text-slate-900">
                  {metrics.roomRanking[0]?.roomName ?? "—"}
                </span>
                <p className="mt-1 text-xs text-slate-600">
                  {metrics.roomRanking[0]
                    ? `${metrics.roomRanking[0].bookedHours}h ocupadas no período`
                    : "Sem dados no período"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-medium text-slate-600">⏱️ Horas totais em atendimento</span>
              <div className="mt-3">
                <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                  {metrics.roomRanking.reduce((sum, r) => sum + r.bookedHours, 0).toFixed(1)}h
                </span>
                <p className="mt-1 text-xs text-slate-600">soma das horas de sessões por sala</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-medium text-slate-600">📊 Ocupação média das salas</span>
              <div className="mt-3">
                <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                  {metrics.roomsAvgOccupancyPct}%
                </span>
                <p className="mt-1 text-xs text-slate-600">estimativa em horário comercial (08h–18h)</p>
              </div>
            </div>
          </div>

          {/* Tabela de ranking operacionais das salas */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-base font-bold text-slate-900">Ranking de Salas por Ocupação & Atendimentos</h3>
              <span className="text-xs text-slate-500">{selectedPeriodLabel}</span>
            </div>

            {metrics.roomRanking.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                      <th className="px-5 py-2">#</th>
                      <th className="px-5 py-2">Sala</th>
                      <th className="px-5 py-2 text-right">Atendimentos</th>
                      <th className="px-5 py-2 text-right">Horas Ocupadas</th>
                      <th className="px-5 py-2">Taxa de Ocupação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.roomRanking.map((room, idx) => {
                      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                      const barColor =
                        room.occupancyPct >= 70
                          ? "bg-emerald-500"
                          : room.occupancyPct >= 40
                            ? "bg-amber-400"
                            : "bg-rose-400";

                      return (
                        <tr key={room.roomId} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-5 py-3 font-semibold text-slate-500">{medal ?? idx + 1}</td>
                          <td className="px-5 py-3">
                            <span className="font-semibold text-slate-900">{room.roomName}</span>
                            <p className="text-xs text-slate-500">capacidade {room.capacity} criança(s)</p>
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-900 font-bold">
                            {room.appointmentsCount}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-700 font-semibold">
                            {room.bookedHours}h
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${Math.max(4, room.occupancyPct)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                {room.occupancyPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <EmptyState
                  title="Nenhuma sala cadastrada ou sem movimento"
                  description={`Não há salas com atendimentos no período de ${selectedPeriodLabel}.`}
                  action={emptyStateAction}
                />
              </div>
            )}
            <p className="px-5 py-4 text-[11px] text-slate-400">
              Taxa de ocupação estimada sobre horário comercial de 08h–18h (10h/dia útil). A Sala de Avaliação possui uso e finalidade diferentes e fica fora deste ranking.
            </p>
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
                      href="/recepcao/atendimento"
                      title="Contato com a família é feito pela Central de Atendimento"
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
    </PageContainer>
  );
}
