"use client";

import React, { useState } from "react";
import type { CalendarSessionEvent, ConflictStatus } from "./pts-printable-calendar";

export type PTSCalendarViewProps = {
  sessions: CalendarSessionEvent[];
  startDate: string;
  validUntil: string;
  onOpenPrintModal: () => void;
  onUpdateSession?: (updatedSession: CalendarSessionEvent) => void;
};

export function PTSCalendarView({
  sessions,
  startDate,
  validUntil,
  onOpenPrintModal,
  onUpdateSession,
}: PTSCalendarViewProps) {
  // Agrupar sessões por mês (YYYY-MM)
  const monthlyGroups = React.useMemo(() => {
    const groups: Record<string, CalendarSessionEvent[]> = {};
    sessions.forEach((s) => {
      const monthKey = s.date.substring(0, 7);
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(s);
    });
    return groups;
  }, [sessions]);

  const monthKeys = Object.keys(monthlyGroups).sort();
  const [activeMonthKey, setActiveMonthKey] = useState<string>(monthKeys[0] || "");

  // Estado da edição manual
  const [editingSession, setEditingSession] = useState<CalendarSessionEvent | null>(null);

  React.useEffect(() => {
    if (monthKeys.length > 0 && !monthKeys.includes(activeMonthKey)) {
      setActiveMonthKey(monthKeys[0]);
    }
  }, [monthKeys, activeMonthKey]);

  if (sessions.length === 0) {
    return null;
  }

  const currentMonthSessions = monthlyGroups[activeMonthKey] || [];

  const handleSaveManualEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSession && onUpdateSession) {
      onUpdateSession({
        ...editingSession,
        conflictStatus: "OK",
        conflictNote: "Ajustado manualmente pelo supervisor",
      });
      setEditingSession(null);
    }
  };

  const renderStatusBadge = (status?: ConflictStatus, note?: string) => {
    switch (status) {
      case "OK":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Conciliado OK
          </span>
        );
      case "HORARIO_ALTERADO":
        return (
          <span
            title={note || "Sessão alocada em horário continuado próximo na mesma data"}
            className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Horário Continuado
          </span>
        );
      case "DIA_ALTERADO":
        return (
          <span
            title={note || "Ocupado na data preferencial, alocado no próximo dia útil"}
            className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Dia Reajustado
          </span>
        );
      case "TURNO_ALTERADO":
        return (
          <span
            title={note || "Ocupado nos dias preferenciais do turno, realocado em turno alternativo"}
            className="inline-flex items-center gap-1 text-[10px] text-orange-300 font-semibold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            Turno Reajustado
          </span>
        );
      case "MANUAL_REQUIRED":
      default:
        return (
          <span
            title={note || "Ocupação persistente. Clique em Ajustar para alocar manualmente."}
            className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-bold bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40 animate-pulse"
          >
            ⚠️ Ajuste Manual
          </span>
        );
    }
  };

  return (
    <div className="mt-6 border border-emerald-500/30 bg-slate-900/60 rounded-xl p-5 shadow-lg backdrop-blur-md">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span className="text-xl">🗓️</span> Calendário de Sessões Conciliado (6 Meses)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Vagas Reservadas Indefinidamente
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Início em {new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")} • Validade do Plano: até{" "}
            {new Date(validUntil + "T00:00:00").toLocaleDateString("pt-BR")} (6 Meses)
          </p>
        </div>

        <button
          onClick={onOpenPrintModal}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-500/20 transition-all border border-indigo-400/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Imprimir Calendário com Timbre
        </button>
      </div>

      {/* Navegação por Meses */}
      <div className="flex items-center gap-2 overflow-x-auto py-3 border-b border-slate-800 scrollbar-thin scrollbar-thumb-slate-700">
        {monthKeys.map((mKey, idx) => {
          const [year, month] = mKey.split("-");
          const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("pt-BR", {
            month: "short",
            year: "numeric",
          });
          const isActive = mKey === activeMonthKey;
          const count = (monthlyGroups[mKey] || []).length;
          const hasManualRequired = (monthlyGroups[mKey] || []).some(
            (s) => s.conflictStatus === "MANUAL_REQUIRED"
          );

          return (
            <button
              key={mKey}
              onClick={() => setActiveMonthKey(mKey)}
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/30"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>
                Mês {idx + 1} ({monthLabel})
              </span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  hasManualRequired
                    ? "bg-rose-500 text-white font-bold animate-pulse"
                    : isActive
                    ? "bg-indigo-800 text-indigo-100"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabela do Mês Selecionado */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase text-[10px]">
              <th className="py-2.5 px-3">Data</th>
              <th className="py-2.5 px-3">Dia da Semana</th>
              <th className="py-2.5 px-3">Especialidade / Terapia</th>
              <th className="py-2.5 px-3">Turno / Horário</th>
              <th className="py-2.5 px-3">Terapeuta Alocado</th>
              <th className="py-2.5 px-3">Sala Prevista</th>
              <th className="py-2.5 px-3">Status Conciliação</th>
              <th className="py-2.5 px-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {currentMonthSessions.map((session) => (
              <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-slate-100">
                  {new Date(session.date + "T00:00:00").toLocaleDateString("pt-BR")}
                </td>
                <td className="py-2.5 px-3 text-slate-400">{session.dayOfWeek}</td>
                <td className="py-2.5 px-3 font-medium text-indigo-300">{session.disciplineLabel}</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      session.shift === "MANHA"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {session.shift === "MANHA" ? "Manhã" : "Tarde"} ({session.timeSlot})
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">{session.therapistName || "Terapeuta Direcionado"}</td>
                <td className="py-2.5 px-3 text-slate-400">{session.roomName || "Sala Integrada"}</td>
                <td className="py-2.5 px-3">{renderStatusBadge(session.conflictStatus, session.conflictNote)}</td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingSession(session)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded border border-indigo-500/30 transition-all"
                  >
                    ✏️ Ajustar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EDIÇÃO/AGENDAMENTO MANUAL PELO SUPERVISOR */}
      {editingSession && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>✏️</span> Ajuste Manual pelo Supervisor
              </h4>
              <button
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Especialidade / Terapia</label>
                <input
                  type="text"
                  disabled
                  value={editingSession.disciplineLabel}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-300 opacity-70"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Data da Sessão</label>
                <input
                  type="date"
                  value={editingSession.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const d = new Date(newDate + "T00:00:00");
                    const dayName = d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase();
                    setEditingSession({ ...editingSession, date: newDate, dayOfWeek: dayName });
                  }}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Turno</label>
                  <select
                    value={editingSession.shift}
                    onChange={(e) =>
                      setEditingSession({
                        ...editingSession,
                        shift: e.target.value as "MANHA" | "TARDE",
                      })
                    }
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
                  >
                    <option value="MANHA">Manhã</option>
                    <option value="TARDE">Tarde</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 mb-1">Horário (Slot)</label>
                  <input
                    type="text"
                    value={editingSession.timeSlot}
                    onChange={(e) => setEditingSession({ ...editingSession, timeSlot: e.target.value })}
                    placeholder="Ex: 09:00 - 10:00"
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Terapeuta Responsável</label>
                <input
                  type="text"
                  value={editingSession.therapistName || ""}
                  onChange={(e) => setEditingSession({ ...editingSession, therapistName: e.target.value })}
                  placeholder="Nome do terapeuta…"
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Sala de Atendimento</label>
                <input
                  type="text"
                  value={editingSession.roomName || ""}
                  onChange={(e) => setEditingSession({ ...editingSession, roomName: e.target.value })}
                  placeholder="Ex: Sala 01 - Fono"
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-3 py-1.5 text-slate-300 hover:bg-slate-800 rounded font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-md"
                >
                  Salvar Ajuste Manual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
