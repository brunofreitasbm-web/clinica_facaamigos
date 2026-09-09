"use client";

import React, { useState } from "react";
import type { CalendarSessionEvent, ConflictStatus } from "./pts-printable-calendar";
import { MonthlyTabs, type MonthlyTabItem } from "@/components/Tabs/MonthlyTabs";
import { generate40MinSlotsForShift } from "@/lib/pts-slots";

type Therapist = { id: string; full_name: string };
type Room = { id: string; name: string };

export type PTSCalendarViewProps = {
  sessions: CalendarSessionEvent[];
  therapists?: Therapist[];
  rooms?: Room[];
  startDate: string;
  validUntil: string;
  onOpenPrintModal: () => void;
  onUpdateSession?: (updatedSession: CalendarSessionEvent) => void;
};

export function PTSCalendarView({
  sessions,
  therapists = [],
  rooms = [],
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
      const isComplete = Boolean(editingSession.therapistId && editingSession.roomId);
      onUpdateSession({
        ...editingSession,
        conflictStatus: isComplete ? "OK" : "MANUAL_REQUIRED",
        conflictNote: isComplete
          ? "Ajustado manualmente pelo supervisor"
          : "Selecione terapeuta e sala reais para esta sessão poder ser salva.",
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
    <div className="mt-6 border border-paper-line-strong bg-white rounded-lg p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-paper-line">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink flex items-center gap-2 m-0">
              <span className="text-xl">🗓️</span> Calendário de Sessões Conciliado (6 Meses)
            </h3>
            <span className="tag-status st-confirmada">
              Vagas Reservadas Indefinidamente
            </span>
          </div>
          <p className="text-xs text-ink-soft mt-1 m-0">
            Início em {new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")} • Validade do Plano: até{" "}
            {new Date(validUntil + "T00:00:00").toLocaleDateString("pt-BR")} (6 Meses)
          </p>
        </div>

        <button
          onClick={onOpenPrintModal}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-chart hover:bg-chart-strong rounded-md shadow-sm transition-all"
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
      <MonthlyTabs
        tabs={monthKeys.map((mKey, idx) => {
          const [year, month] = mKey.split("-");
          const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("pt-BR", {
            month: "short",
            year: "numeric",
          });
          const count = (monthlyGroups[mKey] || []).length;
          const hasManualRequired = (monthlyGroups[mKey] || []).some(
            (s) => s.conflictStatus === "MANUAL_REQUIRED"
          );

          return {
            id: mKey,
            label: `Mês ${idx + 1} (${monthLabel})`,
            count,
            hasAlert: hasManualRequired,
          };
        })}
        activeTabId={activeMonthKey}
        onTabChange={setActiveMonthKey}
      />


      {/* Tabela do Mês Selecionado */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs text-ink border-collapse">
          <thead>
            <tr className="border-b border-paper-line bg-paper text-ink-faint font-semibold uppercase text-[10px]">
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
          <tbody className="divide-y divide-paper-line">
            {currentMonthSessions.map((session) => (
              <tr key={session.id} className="hover:bg-paper/60 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-ink">
                  {new Date(session.date + "T00:00:00").toLocaleDateString("pt-BR")}
                </td>
                <td className="py-2.5 px-3 text-ink-soft">{session.dayOfWeek}</td>
                <td className="py-2.5 px-3 font-medium text-chart-strong">{session.disciplineLabel}</td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      session.shift === "MANHA"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : session.shift === "TARDE"
                        ? "bg-blue-100 text-blue-900 border border-blue-300"
                        : "bg-purple-100 text-purple-900 border border-purple-300"
                    }`}
                  >
                    {session.shift === "MANHA" ? "Manhã" : session.shift === "TARDE" ? "Tarde" : "Noite"} ({session.timeSlot})
                  </span>
                </td>
                <td className="py-2.5 px-3 text-ink-soft">{session.therapistName || "Terapeuta Direcionado"}</td>
                <td className="py-2.5 px-3 text-ink-faint">{session.roomName || "Sala Integrada"}</td>
                <td className="py-2.5 px-3">{renderStatusBadge(session.conflictStatus, session.conflictNote)}</td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingSession(session)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-chart bg-chart-soft hover:bg-chart-soft/80 rounded border border-chart/30 transition-all"
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
        <div className="dialog-backdrop z-50">
          <div className="dialog max-w-md bg-white border border-paper-line-strong rounded-xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <h4 className="text-sm font-bold text-ink flex items-center gap-2 m-0">
                <span>✏️</span> Ajuste Manual pelo Supervisor
              </h4>
              <button
                onClick={() => setEditingSession(null)}
                className="text-ink-faint hover:text-ink text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-ink-soft mb-1">Especialidade / Terapia</label>
                <input
                  type="text"
                  disabled
                  value={editingSession.disciplineLabel}
                  className="w-full rounded bg-paper border border-paper-line-strong px-3 py-1.5 text-ink-soft opacity-70"
                />
              </div>

              <div>
                <label className="block font-bold text-ink-soft mb-1">Data da Sessão</label>
                <input
                  type="date"
                  value={editingSession.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const d = new Date(newDate + "T00:00:00");
                    const dayName = d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase();
                    setEditingSession({ ...editingSession, date: newDate, dayOfWeek: dayName });
                  }}
                  className="w-full rounded bg-white border border-paper-line-strong px-3 py-1.5 text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-ink-soft mb-1">Turno</label>
                  <select
                    value={editingSession.shift}
                    onChange={(e) => {
                      const newShift = e.target.value as "MANHA" | "TARDE" | "NOITE";
                      const slotsForShift = generate40MinSlotsForShift(newShift);
                      setEditingSession({
                        ...editingSession,
                        shift: newShift,
                        timeSlot: slotsForShift[0] || "",
                      });
                    }}
                    className="w-full rounded bg-white border border-paper-line-strong px-3 py-1.5 text-ink"
                  >
                    <option value="MANHA">Manhã</option>
                    <option value="TARDE">Tarde</option>
                    <option value="NOITE">Noite</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-ink-soft mb-1">Horário (Slot)</label>
                  <select
                    value={editingSession.timeSlot}
                    onChange={(e) => setEditingSession({ ...editingSession, timeSlot: e.target.value })}
                    className="w-full rounded bg-white border border-paper-line-strong px-3 py-1.5 text-ink"
                  >
                    {!generate40MinSlotsForShift(editingSession.shift).includes(editingSession.timeSlot) &&
                      editingSession.timeSlot && (
                        <option value={editingSession.timeSlot}>{editingSession.timeSlot}</option>
                      )}
                    {generate40MinSlotsForShift(editingSession.shift).map((slotStr) => (
                      <option key={slotStr} value={slotStr}>
                        {slotStr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-ink-soft mb-1">Terapeuta Responsável</label>
                <select
                  value={editingSession.therapistId || ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setEditingSession({
                      ...editingSession,
                      therapistId: id,
                      therapistName: therapists.find((t) => t.id === id)?.full_name,
                    });
                  }}
                  className="w-full rounded bg-white border border-paper-line-strong px-3 py-1.5 text-ink"
                >
                  <option value="">Sem direcionamento (não será salvo como sessão real)</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-ink-soft mb-1">Sala de Atendimento</label>
                <select
                  value={editingSession.roomId || ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setEditingSession({
                      ...editingSession,
                      roomId: id,
                      roomName: rooms.find((r) => r.id === id)?.name,
                    });
                  }}
                  className="w-full rounded bg-white border border-paper-line-strong px-3 py-1.5 text-ink"
                >
                  <option value="">Sem sala definida (não será salvo como sessão real)</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-paper-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="btn btn-ghost text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
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
