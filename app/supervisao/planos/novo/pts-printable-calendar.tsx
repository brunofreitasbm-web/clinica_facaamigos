"use client";

import React from "react";

export type ConflictStatus =
  | "OK"
  | "HORARIO_ALTERADO"
  | "DIA_ALTERADO"
  | "TURNO_ALTERADO"
  | "MANUAL_REQUIRED";

export type CalendarSessionEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  disciplineLabel: string;
  therapistName?: string;
  roomName?: string;
  shift: "MANHA" | "TARDE" | "NOITE";
  timeSlot: string;
  conflictStatus?: ConflictStatus;
  conflictNote?: string;
};

export type MonthPrintability = {
  allowed: boolean;
  reason: string;
  isCurrent: boolean;
  unlockDate: Date | null;
  label: string;
};

/**
 * Regra de Liberação de Impressão Timbrada:
 * - Mês Corrente (Atual) ou histórico: Sempre liberado.
 * - Mês Seguinte (Subsequente): Liberado apenas a partir de 10 dias de antecedência do início do próximo mês.
 * - Meses Futuros (M+2 em diante): Bloqueados para impressão.
 */
export function checkMonthPrintability(monthKey: string, currentDate: Date = new Date()): MonthPrintability {
  const [yearStr, monthStr] = monthKey.split("-");
  const targetYear = parseInt(yearStr, 10);
  const targetMonth = parseInt(monthStr, 10) - 1; // 0-indexed (0 = Jan, 8 = Set)

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  const monthDate = new Date(targetYear, targetMonth, 1);
  const monthLabel = monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const formattedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Se o mês for igual ou anterior ao mês atual no calendário: liberado
  if (targetYear < currentYear || (targetYear === currentYear && targetMonth <= currentMonth)) {
    const isCurrent = targetYear === currentYear && targetMonth === currentMonth;
    return {
      allowed: true,
      reason: isCurrent ? "Mês Corrente (Liberado)" : "Mês Anterior (Liberado)",
      isCurrent,
      unlockDate: null,
      label: formattedMonthLabel,
    };
  }

  // Verificar se é exatamente o mês subsequente (M+1)
  const isNextMonth =
    (targetYear === currentYear && targetMonth === currentMonth + 1) ||
    (targetYear === currentYear + 1 && currentMonth === 11 && targetMonth === 0);

  if (isNextMonth) {
    const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Ex: Em setembro (30 dias), 30 - 9 = 21 (liberado nos dias 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 -> 10 dias de antecedência)
    const unlockDay = Math.max(1, lastDayOfCurrentMonth - 9);
    const unlockDate = new Date(currentYear, currentMonth, unlockDay);

    const allowed = currentDay >= unlockDay;
    return {
      allowed,
      reason: allowed
        ? "Mês Seguinte (Liberado - dentro dos 10 dias de antecedência)"
        : `Liberado para impressão em ${unlockDate.toLocaleDateString("pt-BR")}`,
      isCurrent: false,
      unlockDate,
      label: formattedMonthLabel,
    };
  }

  // Meses posteriores (M+2 em diante)
  const prevMonthDate = new Date(targetYear, targetMonth, 0);
  const unlockDay = Math.max(1, prevMonthDate.getDate() - 9);
  const unlockDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), unlockDay);

  return {
    allowed: false,
    reason: `Liberado para impressão em ${unlockDate.toLocaleDateString("pt-BR")}`,
    isCurrent: false,
    unlockDate,
    label: formattedMonthLabel,
  };
}

export type PTSPrintableCalendarProps = {
  patientName: string;
  patientId?: string;
  guardianName?: string;
  guardianPhone?: string;
  planName?: string;
  startDate: string;
  validUntil: string;
  sessions: CalendarSessionEvent[];
  clinicName?: string;
  clinicAddress?: string;
  clinicCnpj?: string;
  onClose?: () => void;
};

export function PTSPrintableCalendar({
  patientName,
  guardianName = "Responsável Legal",
  guardianPhone = "Não informado",
  planName = "Plano Terapêutico Singular (PTS)",
  startDate,
  validUntil,
  sessions,
  clinicName = "Clínica de Desenvolvimento Infantil",
  clinicAddress = "Unidade Central - Atendimento Multidisciplinar",
  clinicCnpj = "12.345.678/0001-90",
  onClose,
}: PTSPrintableCalendarProps) {
  const currentDate = React.useMemo(() => new Date(), []);

  // Agrupar por mês
  const monthlyGroups = React.useMemo(() => {
    const groups: Record<string, CalendarSessionEvent[]> = {};
    sessions.forEach((s) => {
      const monthKey = s.date.substring(0, 7); // YYYY-MM
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(s);
    });
    return groups;
  }, [sessions]);

  const monthKeys = React.useMemo(() => Object.keys(monthlyGroups).sort(), [monthlyGroups]);

  // Mapa de permissões de impressão por mês
  const monthPrintabilityMap = React.useMemo(() => {
    const map: Record<string, MonthPrintability> = {};
    monthKeys.forEach((key) => {
      map[key] = checkMonthPrintability(key, currentDate);
    });
    return map;
  }, [monthKeys, currentDate]);

  // Mês selecionado para visualização e impressão (sempre um único mês por vez)
  const [selectedFilter, setSelectedFilter] = React.useState<string>(() => {
    const firstAllowed = monthKeys.find((key) => monthPrintabilityMap[key]?.allowed);
    return firstAllowed || monthKeys[0] || "";
  });

  const handlePrint = () => {
    window.print();
  };

  const canPrintSelected = Boolean(selectedFilter) && monthPrintabilityMap[selectedFilter]?.allowed;

  React.useEffect(() => {
    if (monthKeys.length > 0 && !monthKeys.includes(selectedFilter)) {
      const firstAllowed = monthKeys.find((key) => monthPrintabilityMap[key]?.allowed);
      setSelectedFilter(firstAllowed || monthKeys[0]);
    }
  }, [monthKeys, monthPrintabilityMap, selectedFilter]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm p-4 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Botões de Ação na Tela e Controles (Ocultados na Impressão) */}
      <div className="max-w-4xl mx-auto mb-4 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-xl shadow-xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Validade de 6 Meses (Reserva Recorrente)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
              >
                Fechar Visualização
              </button>
            )}
            <button
              onClick={handlePrint}
              type="button"
              disabled={!canPrintSelected}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir Calendário do Mês{selectedFilter && monthPrintabilityMap[selectedFilter] ? ` — ${monthPrintabilityMap[selectedFilter].label}` : ""}
            </button>
          </div>
        </div>

        {/* Regra de Impressão Informativa (Painel Didático) */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200/90 flex items-start gap-2.5 shadow-md">
          <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <strong className="text-amber-300 font-semibold block mb-0.5">Regra de Impressão com Timbre da Clínica:</strong>
            <span>
              A impressão é sempre feita <strong>um mês por vez</strong>. Selecione o mês desejado nas abas abaixo. Impressão liberada apenas para o <strong>mês corrente</strong> e para o <strong>mês seguinte (com até 10 dias de antecedência do início do próximo mês)</strong>. Meses futuros permanecem bloqueados e serão liberados automaticamente no prazo.
            </span>
          </div>
        </div>

        {/* Abas / Seleção do Mês para Impressão */}
        {monthKeys.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {monthKeys.map((key) => {
              const printability = monthPrintabilityMap[key];
              const isSelected = selectedFilter === key;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedFilter(key)}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-500 shadow"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  <span>{printability.label}</span>
                  {printability.allowed ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Liberado
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m8-6V7a4 4 0 00-8 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                      </svg>
                      Bloqueado
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Documento Imprimível */}
      <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-xl shadow-2xl p-8 print:shadow-none print:rounded-none print:p-0 print:max-w-none print:w-full">
        {/* Timbre da Clínica */}
        <div className="border-b-2 border-indigo-600 pb-6 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-indigo-950 uppercase tracking-wide">{clinicName}</h1>
            <p className="text-xs text-slate-600 font-medium">{clinicAddress}</p>
            <p className="text-xs text-slate-500">CNPJ: {clinicCnpj}</p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-md border border-indigo-200 uppercase tracking-wider">
              Calendário Oficial do PTS
            </span>
            <p className="text-xs text-slate-500 mt-1">Validade: 6 Meses (Renovável)</p>
          </div>
        </div>

        {/* Quadro de Informações do Paciente e Plano */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Paciente</span>
            <strong className="text-slate-900 text-sm">{patientName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Responsável Legal</span>
            <strong className="text-slate-800">{guardianName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Contato Responsável</span>
            <span className="text-slate-800">{guardianPhone}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Plano Terapêutico</span>
            <span className="text-slate-800 font-medium">{planName}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Data de Início</span>
            <span className="text-slate-800 font-medium">{new Date(startDate).toLocaleDateString("pt-BR")}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Validade Inicial</span>
            <span className="text-emerald-700 font-bold">{new Date(validUntil).toLocaleDateString("pt-BR")} (6 Meses)</span>
          </div>
        </div>

        {/* Informação sobre Reserva Indefinida */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mb-6 text-xs text-emerald-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Garantia de Vaga & Grade Recorrente:</strong> Enquanto o paciente mantiver vínculo ativo (sem desistência/evasão), os dias, horários e salas descritos permanecem reservados indefinidamente.
          </span>
        </div>

        {/* Tabela de Sessões Mês a Mês */}
        <div className="space-y-6">
          {monthKeys.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">Nenhuma sessão agendada no período.</p>
          ) : (
            monthKeys.map((monthKey) => {
              const printability = monthPrintabilityMap[monthKey];
              const items = monthlyGroups[monthKey];

              // Renderiza (e portanto imprime) apenas o mês selecionado nas abas
              if (selectedFilter !== monthKey) {
                return null;
              }

              // Se o mês for bloqueado para impressão:
              if (!printability.allowed) {
                return (
                  <div key={monthKey} className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 text-xs text-amber-900 print:hidden">
                    <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m8-6V7a4 4 0 00-8 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                      </svg>
                      <span>{printability.label} — Impressão Indisponível no Momento</span>
                    </div>
                    <p className="text-slate-600">
                      Conforme política da clínica, calendários timbrados para este período só podem ser impressos com antecedência máxima de 10 dias.
                    </p>
                    <p className="font-semibold text-amber-800 mt-1">
                      {printability.reason}
                    </p>
                  </div>
                );
              }

              // Mês Liberado -> Renderiza normalmente (visível na tela e na impressão)
              return (
                <div key={monthKey} className="break-inside-avoid">
                  <div className="bg-indigo-900 text-white px-3 py-1.5 rounded-t-md text-xs font-bold uppercase tracking-wider flex justify-between items-center">
                    <span>{printability.label}</span>
                    <span className="text-[10px] bg-indigo-800 px-2 py-0.5 rounded text-indigo-100">{items.length} Sessões</span>
                  </div>

                  <table className="w-full border-collapse border border-slate-200 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="py-2 px-3 text-left w-28">Data</th>
                        <th className="py-2 px-3 text-left w-24">Dia da Semana</th>
                        <th className="py-2 px-3 text-left">Especialidade / Terapia</th>
                        <th className="py-2 px-3 text-left w-24">Turno / Horário</th>
                        <th className="py-2 px-3 text-left">Terapeuta</th>
                        <th className="py-2 px-3 text-left w-28">Sala</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((session) => (
                        <tr key={session.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {new Date(session.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{session.dayOfWeek}</td>
                          <td className="py-2 px-3 font-semibold text-indigo-900">{session.disciplineLabel}</td>
                          <td className="py-2 px-3 text-slate-700">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${session.shift === "MANHA" ? "bg-amber-100 text-amber-800" : session.shift === "TARDE" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>
                              {session.shift === "MANHA" ? "Manhã" : session.shift === "TARDE" ? "Tarde" : "Noite"} ({session.timeSlot})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-800">{session.therapistName || "Terapeuta Direcionado"}</td>
                          <td className="py-2 px-3 text-slate-600">{session.roomName || "Sala Alocada"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé de Assinatura (Exibido na Impressão) */}
        <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-b border-slate-400 mb-2 w-3/4 mx-auto"></div>
            <p className="font-semibold text-slate-800">{guardianName}</p>
            <p className="text-slate-500 text-[10px]">Assinatura do Responsável Legal</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mb-2 w-3/4 mx-auto"></div>
            <p className="font-semibold text-slate-800">Supervisão Técnica da Clínica</p>
            <p className="text-slate-500 text-[10px]">Coordenação Multidisciplinar</p>
          </div>
        </div>
      </div>
    </div>
  );
}

