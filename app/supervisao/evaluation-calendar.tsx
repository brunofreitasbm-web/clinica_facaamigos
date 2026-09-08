"use client";

import { useEffect, useMemo, useState } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { dayIndexInWeek, timeLabel, type WeekInfo } from "./grade-data";
import {
  getEvaluationCalendarWeekAction,
  getEvaluationPoolAction,
  scheduleFromPoolAction,
  rescheduleEvaluationAction,
} from "./evaluation-calendar-actions";
import type { EvaluationAgendaOrigin, EvaluationCalendarAppointment, EvaluationPoolItem } from "@/lib/evaluation-agenda";

/**
 * Calendário semanal de 1ª avaliação — visão única, independente de onde o
 * paciente veio (WhatsApp/anamnese, PDF de convênio, presencial). Arrastar um
 * card da fila lateral pra uma célula agenda a avaliação; arrastar um card já
 * agendado pra outra célula reagenda. Sem lib de calendário/DnD — grid CSS +
 * Drag and Drop nativo do HTML5 bastam pro escopo.
 *
 * Semana própria (Seg–Sáb), não reaproveita currentWeek/weekBounds de
 * grade-data.ts (que são fixos a Seg–Sex, pro grid de terapia recorrente) —
 * horário de funcionamento da clínica inclui sábado de manhã.
 */

const ORIGIN_LABEL: Record<EvaluationAgendaOrigin, string> = {
  whatsapp_anamnese: "WhatsApp · Anamnese",
  convenio_pdf: "PDF de convênio",
  presencial: "Presencial",
};

const ORIGIN_TAG: Record<EvaluationAgendaOrigin, string> = {
  whatsapp_anamnese: "st-agendada",
  convenio_pdf: "st-confirmada",
  presencial: "st-realizada",
};

const WEEKDAY_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
/** Hora de fechamento por dia da semana (índice 0=Seg..5=Sáb) — Seg–Sex 19h, Sáb 12h. */
const CLOSING_HOUR_BY_DAY = [19, 19, 19, 19, 19, 12];
const DAY_START_HOUR = 8;
const GRID_END_HOUR = 19; // maior horário de fechamento da semana (Seg–Sex) — usado só pra desenhar a grade
const TOTAL_MINUTES = (GRID_END_HOUR - DAY_START_HOUR) * 60;
const ROW_MINUTES = 30;
const ROW_HEIGHT_PX = 28;
const COLUMN_HEIGHT_PX = (TOTAL_MINUTES / ROW_MINUTES) * ROW_HEIGHT_PX;
const HOUR_MARKS = Array.from({ length: GRID_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
const EVALUATION_DURATION_MINUTES = 50;

/** `YYYY-MM-DD` + `n` dias corridos, aritmética de calendário pura (sem fuso). */
function addDaysStr(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + n)).toISOString().slice(0, 10);
}

/** Segunda-feira (`YYYY-MM-DD`) da semana civil que contém `dateStr`. */
function mondayOfStr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=dom..6=sáb
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDaysStr(dateStr, diffToMonday);
}

function shortDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** Semana civil (Seg–Sáb) que contém `anchorDateStr` — horário comercial inclui sábado de manhã. */
function evaluationWeek(anchorDateStr: string): WeekInfo & { rangeLabel: string } {
  const monday = mondayOfStr(anchorDateStr);
  const days = Array.from({ length: 6 }, (_, i) => addDaysStr(monday, i));
  return { days, weekNumber: 0, rangeLabel: `${shortDateStr(days[0])} – ${shortDateStr(days[5])}` };
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

type DragPayload =
  | { kind: "pool"; poolItemId: string }
  | { kind: "reschedule"; appointmentId: string; durationMinutes: number };

export function EvaluationCalendar({
  pool: initialPool,
  therapists,
  rooms,
}: {
  pool: EvaluationPoolItem[];
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
}) {
  const [weekAnchor, setWeekAnchor] = useState(() => todayInTimeZone(CLINIC_TIMEZONE));
  const [appointments, setAppointments] = useState<EvaluationCalendarAppointment[]>([]);
  const [pool, setPool] = useState(initialPool);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [therapistId, setTherapistId] = useState(therapists[0]?.id ?? "");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const week = useMemo(() => evaluationWeek(weekAnchor), [weekAnchor]);
  const bounds = useMemo(() => ({ start: week.days[0], end: addDaysStr(week.days[5], 1) }), [week]);

  // Une os terapeutas cadastrados como avaliadores com quem de fato aparece
  // agendado na semana visível — sem isso o dropdown pode dizer "nenhum
  // terapeuta avaliador cadastrado" enquanto o grid mostra agendamentos reais,
  // já que o agendamento em si não exige a flag is_evaluator.
  const availableTherapists = useMemo(() => {
    const byId = new Map(therapists.map((t) => [t.id, t] as const));
    for (const a of appointments) {
      if (!byId.has(a.therapistId)) byId.set(a.therapistId, { id: a.therapistId, name: a.therapistName });
    }
    return Array.from(byId.values());
  }, [therapists, appointments]);

  useEffect(() => {
    if (!therapistId && availableTherapists.length > 0) setTherapistId(availableTherapists[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTherapists]);

  async function fetchWeek() {
    setLoading(true);
    const res = await getEvaluationCalendarWeekAction(bounds.start);
    if (res.success) setAppointments(res.appointments);
    setLoading(false);
  }

  async function fetchPool() {
    const res = await getEvaluationPoolAction();
    if (res.success) setPool(res.pool);
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchWeek();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start]);

  const readyPool = pool.filter((p) => p.ready);
  const waitingPool = pool.filter((p) => !p.ready);

  function computeTimeFromOffsetY(offsetY: number): string {
    const rawMinutes = (offsetY / ROW_HEIGHT_PX) * ROW_MINUTES;
    const snapped = Math.max(0, Math.min(TOTAL_MINUTES - ROW_MINUTES, Math.round(rawMinutes / ROW_MINUTES) * ROW_MINUTES));
    const hour = DAY_START_HOUR + Math.floor(snapped / 60);
    const minute = snapped % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  async function handleDrop(dayIndex: number, offsetY: number, payload: DragPayload) {
    const date = week.days[dayIndex];
    const time = computeTimeFromOffsetY(offsetY);
    const durationMinutes = payload.kind === "reschedule" ? payload.durationMinutes : EVALUATION_DURATION_MINUTES;
    const endMinutes = parseTimeToMinutes(time) + durationMinutes;
    const closingHour = CLOSING_HOUR_BY_DAY[dayIndex];

    setFeedback(null);

    if (endMinutes > closingHour * 60) {
      setFeedback({
        type: "error",
        text:
          dayIndex === 5
            ? "Sábado o atendimento vai só até 12h — escolha um horário que termine até lá."
            : `Fora do horário de atendimento — encerra às ${closingHour}h.`,
      });
      return;
    }

    if (payload.kind === "pool") {
      const item = pool.find((p) => p.id === payload.poolItemId);
      if (!item) return;
      if (!therapistId || !roomId) {
        setFeedback({ type: "error", text: "Selecione terapeuta e sala antes de agendar." });
        return;
      }
      const res = await scheduleFromPoolAction(item.bookInput, therapistId, roomId, date, time);
      setFeedback(
        res.success
          ? { type: "success", text: `${item.patientName} agendado(a) para ${date.split("-").reverse().join("/")} às ${time}.` }
          : { type: "error", text: res.error },
      );
      if (res.success) {
        await Promise.all([fetchWeek(), fetchPool()]);
      }
    } else {
      const res = await rescheduleEvaluationAction(payload.appointmentId, date, time, payload.durationMinutes);
      setFeedback(res.success ? { type: "success", text: "Avaliação reagendada." } : { type: "error", text: res.error });
      if (res.success) await fetchWeek();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addDaysStr(d, -7))}
            className="rounded-md border border-paper-line-strong px-2 py-1 text-sm font-semibold text-ink-soft hover:bg-paper"
          >
            ‹
          </button>
          <span className="text-sm font-bold text-ink">{week.rangeLabel}</span>
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addDaysStr(d, 7))}
            className="rounded-md border border-paper-line-strong px-2 py-1 text-sm font-semibold text-ink-soft hover:bg-paper"
          >
            ›
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Terapeuta avaliador</label>
          <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="input text-xs">
            {availableTherapists.length === 0 && <option value="">Nenhum terapeuta avaliador cadastrado</option>}
            {availableTherapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Sala</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input text-xs">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <p className={`text-xs ${feedback.type === "success" ? "text-status-positive-text" : "text-status-negative-text"}`}>{feedback.text}</p>
      )}

      <div className="flex gap-4">
        {/* Fila lateral */}
        <aside className="w-64 shrink-0">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Aguardando agendamento ({pool.length})</h3>
          <div className="flex flex-col gap-2">
            {readyPool.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify({ kind: "pool", poolItemId: item.id } satisfies DragPayload));
                }}
                className="cursor-grab rounded-md border border-paper-line-strong bg-white p-2.5 shadow-sm active:cursor-grabbing"
                title="Arraste para uma célula do calendário"
              >
                <p className="text-xs font-semibold text-ink">{item.patientName}</p>
                <span className={`tag-status mt-1 inline-block ${ORIGIN_TAG[item.origin]}`}>{ORIGIN_LABEL[item.origin]}</span>
                <p className="mt-1 text-[11px] text-ink-faint">{item.detail}</p>
              </div>
            ))}
            {waitingPool.map((item) => (
              <div key={item.id} className="rounded-md border border-dashed border-paper-line-strong bg-paper p-2.5 opacity-70">
                <p className="text-xs font-semibold text-ink-soft">{item.patientName}</p>
                <span className={`tag-status mt-1 inline-block ${ORIGIN_TAG[item.origin]}`}>{ORIGIN_LABEL[item.origin]}</span>
                <p className="mt-1 text-[11px] text-ink-faint">{item.statusLabel} — aprove antes de agendar.</p>
              </div>
            ))}
            {pool.length === 0 && <p className="text-xs text-ink-faint">Nenhum paciente aguardando 1ª avaliação.</p>}
          </div>
        </aside>

        {/* Grade semanal */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <p className="p-4 text-sm text-ink-faint">Carregando semana…</p>
          ) : (
            <div className="flex" style={{ minWidth: 760 }}>
              <div className="w-14 shrink-0 pt-6">
                {HOUR_MARKS.map((h) => (
                  <div key={h} style={{ height: ROW_HEIGHT_PX * (60 / ROW_MINUTES) }} className="text-right text-[11px] text-ink-faint">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {week.days.map((day, dayIndex) => {
                const dayAppointments = appointments.filter((a) => dayIndexInWeek(a.startsAt, week, CLINIC_TIMEZONE) === dayIndex);
                const closingHour = CLOSING_HOUR_BY_DAY[dayIndex];
                const closedFromMinutes = (closingHour - DAY_START_HOUR) * 60;
                const closedTop = (closedFromMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
                const closedHeight = COLUMN_HEIGHT_PX - closedTop;
                return (
                  <div key={day} className="flex-1 border-l border-paper-line pl-1">
                    <div className="pb-1 text-center text-xs font-bold text-ink">{WEEKDAY_LABEL[dayIndex]}</div>
                    <div
                      className="relative rounded-md"
                      style={{
                        height: COLUMN_HEIGHT_PX,
                        background: dragOverDay === dayIndex ? "var(--color-accent-100)" : "var(--color-paper)",
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverDay(dayIndex);
                      }}
                      onDragLeave={() => setDragOverDay((d) => (d === dayIndex ? null : d))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverDay(null);
                        const raw = e.dataTransfer.getData("application/json");
                        if (!raw) return;
                        const payload = JSON.parse(raw) as DragPayload;
                        const rect = e.currentTarget.getBoundingClientRect();
                        handleDrop(dayIndex, e.clientY - rect.top, payload);
                      }}
                    >
                      {Array.from({ length: TOTAL_MINUTES / 60 }, (_, i) => (
                        <div key={i} className="border-t border-paper-line" style={{ height: ROW_HEIGHT_PX * (60 / ROW_MINUTES) }} />
                      ))}
                      {closedHeight > 0 && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 flex items-start justify-center rounded-b-md pt-1 text-[10px] font-semibold text-ink-faint"
                          style={{
                            top: closedTop,
                            height: closedHeight,
                            background:
                              "repeating-linear-gradient(45deg, var(--color-neutral-200), var(--color-neutral-200) 6px, transparent 6px, transparent 12px)",
                          }}
                        >
                          Fechado
                        </div>
                      )}
                      {dayAppointments.map((a) => {
                        const startMinutes = parseTimeToMinutes(timeLabel(a.startsAt, CLINIC_TIMEZONE)) - DAY_START_HOUR * 60;
                        const durationMinutes = Math.max(30, (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000);
                        const top = (startMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
                        const height = (durationMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
                        return (
                          <div
                            key={a.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "application/json",
                                JSON.stringify({ kind: "reschedule", appointmentId: a.id, durationMinutes } satisfies DragPayload),
                              );
                            }}
                            className="absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded-md border p-1 text-[11px] shadow-sm active:cursor-grabbing"
                            style={{ top, height, background: "var(--status-agendada-bg)", borderColor: "var(--paper-line-strong)" }}
                            title={`${a.patientName} · ${a.therapistName} · ${a.roomName}`}
                          >
                            <p className="truncate font-semibold text-ink">{a.patientName}</p>
                            <p className="truncate text-ink-soft">{timeLabel(a.startsAt, CLINIC_TIMEZONE)} · {a.therapistName}</p>
                            <span className={`tag-status ${ORIGIN_TAG[a.origin]}`}>{ORIGIN_LABEL[a.origin]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
