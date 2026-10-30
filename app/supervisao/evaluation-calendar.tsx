"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { closureReason, type ClinicClosure } from "@/lib/clinic-calendar-pure";
import { useToast } from "@/components/toast-provider";
import { createClient } from "@/lib/supabase/client";
import { dayIndexInWeek, timeLabel, type WeekInfo } from "./grade-data";
import {
  getEvaluationCalendarWeekAction,
  getEvaluationPoolAction,
  rejectEvaluationOfferAction,
  restartEvaluationOfferAction,
  cancelEvaluationOfferAction,
  getEvaluationDayCountsAction,
  getEvaluatorsAvailabilityAction,
  scheduleFromPoolAction,
  suggestNearestEvaluationSlotAction,
  rescheduleEvaluationAction,
  updateEvaluationAppointmentAction,
  cancelEvaluationAppointmentAction,
  confirmEvaluationAppointmentAction,
  getPendingConfirmationsAction,
  type TherapistAvailabilityBlock,
  type PendingConfirmationItem,
} from "./evaluation-calendar-actions";
import type {
  EvaluationAgendaOrigin,
  EvaluationCalendarAppointment,
  EvaluationOfferItem,
  EvaluationPoolFacts,
  EvaluationPoolItem,
} from "@/lib/evaluation-agenda";
import { EvaluationQuickViewPanel } from "./evaluation-quick-view";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { isLiveOffer, offerBadge, type OfferBadge } from "@/lib/evaluation-offer-badge-pure";

/**
 * Calendário semanal de 1ª avaliação — visão única, independente de onde o
 * paciente veio (WhatsApp/anamnese, PDF de convênio, presencial). Três
 * caminhos pra agendar, todos terminando no mesmo diálogo de confirmação
 * (paciente · dia · horário · avaliador · sala visíveis antes de gravar):
 * arrastar um card da fila pra grade, clicar num horário vazio da grade, ou
 * o botão "Agendar" do card (caminho de teclado). Arrastar um card já
 * agendado pra outra célula reagenda. Sem lib de calendário/DnD — grid CSS +
 * Drag and Drop nativo do HTML5 bastam pro escopo.
 *
 * Semana própria (Seg–Sáb), não reaproveita currentWeek/weekBounds de
 * grade-data.ts (que são fixos a Seg–Sex, pro grid de terapia recorrente) —
 * horário de funcionamento da clínica inclui sábado de manhã.
 */

const ORIGIN_LABEL: Record<EvaluationAgendaOrigin, string> = {
  whatsapp_anamnese: "WhatsApp · Anamnese",
  convenio_pdf: "PDF de plano de saúde",
  presencial: "Presencial",
  family_meeting: "Reunião · Responsável",
  patient_feedback: "Devolutiva do paciente",
};

// Origem é categoria, não status: chip contornado com ponto colorido, pra
// não competir com as tags preenchidas de status (Aguardando, OK da
// Recepção) — antes "Devolutiva" usava st-cancelada e parecia cancelada.
const ORIGIN_DOT: Record<EvaluationAgendaOrigin, string> = {
  whatsapp_anamnese: "var(--color-status-pending-text)",
  convenio_pdf: "var(--color-status-positive-text)",
  presencial: "var(--color-status-realizada-text)",
  family_meeting: "var(--color-status-active-text)",
  patient_feedback: "var(--color-status-neutral-text)",
};

function OriginChip({ origin }: { origin: EvaluationAgendaOrigin }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-paper-line-strong bg-white px-1.5 py-px text-[10px] font-medium text-ink-soft">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ORIGIN_DOT[origin] }} />
      <span className="truncate">{ORIGIN_LABEL[origin]}</span>
    </span>
  );
}

/** Espera a partir da qual o card do cadastro presencial fica em alerta. */
const LONG_WAIT_DAYS = 7;

// Cadastro presencial: a origem não diz nada (toda avaliação é presencial) —
// no lugar, o que decide avaliador e horário: convênio, idade e tempo de espera.
function PoolFactsChips({ facts }: { facts: EvaluationPoolFacts }) {
  const chip =
    "inline-flex max-w-full items-center rounded-full border border-paper-line-strong bg-white px-1.5 py-px text-[10px] font-medium text-ink-soft";
  return (
    <>
      <span className={chip} title="Convênio informado no cadastro">
        <span className="truncate">{facts.insurer ?? "Convênio não informado"}</span>
      </span>
      {facts.age && <span className={chip}>{facts.age}</span>}
      <span
        className={`tag-status ${facts.waitingDays >= LONG_WAIT_DAYS ? "st-falta" : "st-cancelada"}`}
        title="Dias desde o cadastro na Recepção"
      >
        {facts.waitingDays === 0 ? "Cadastrado hoje" : `Espera ${facts.waitingDays} dia${facts.waitingDays === 1 ? "" : "s"}`}
      </span>
    </>
  );
}

const BAND_STYLE: Record<OfferBadge["tone"], string> = {
  amber: "border-amber-400 bg-amber-100 text-amber-900",
  blue: "border-sky-400 bg-sky-100 text-sky-900",
  red: "border-status-negative-text/40 bg-status-negative-soft text-status-negative-text",
};

/** Faixa chamativa do card: em que passo do fluxo automático o responsável está agora. */
function OfferStatusBand({ badge }: { badge: OfferBadge }) {
  return (
    <div role="status" className={`mt-1.5 rounded-md border px-2 py-1.5 ${BAND_STYLE[badge.tone]}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full bg-current ${badge.live ? "animate-pulse" : ""}`} />
        {badge.title}
      </p>
      {badge.detail && <p className="mt-0.5 text-[10px] leading-snug">{badge.detail}</p>}
    </div>
  );
}

const WEEKDAY_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
/** Hora de fechamento por dia da semana (índice 0=Seg..5=Sáb) — Seg–Sex 19h, Sáb 12h. */
const CLOSING_HOUR_BY_DAY = [19, 19, 19, 19, 19, 12];
const DAY_START_HOUR = 8;
const GRID_END_HOUR = 19; // maior horário de fechamento da semana (Seg–Sex) — usado só pra desenhar a grade
const TOTAL_MINUTES = (GRID_END_HOUR - DAY_START_HOUR) * 60;
const ROW_MINUTES = 30;
const ROW_HEIGHT_PX = 34;
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

function brDate(dateStr: string): string {
  return dateStr.split("-").reverse().join("/");
}

/** Semana civil (Seg–Sáb) que contém `anchorDateStr` — horário comercial inclui sábado de manhã. */
function evaluationWeek(anchorDateStr: string): WeekInfo & { rangeLabel: string } {
  const monday = mondayOfStr(anchorDateStr);
  const days = Array.from({ length: 6 }, (_, i) => addDaysStr(monday, i));
  return { days, weekNumber: 0, rangeLabel: `${shortDateStr(days[0])} – ${shortDateStr(days[5])} ${days[5].slice(0, 4)}` };
}

const MONTH_WEEKDAY_LABEL = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

/** Primeiro dia (`YYYY-MM-01`) do mês que contém `dateStr`. */
function firstOfMonthStr(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** `YYYY-MM-01` + `n` meses. */
function addMonthsStr(monthStr: string, n: number): string {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + n, 1)).toISOString().slice(0, 10);
}

function monthLabelStr(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Células do mês (Seg→Dom), completando as semanas com dias do mês vizinho. */
function monthCells(monthStr: string): string[] {
  const start = mondayOfStr(monthStr);
  const next = addMonthsStr(monthStr, 1);
  const lastDay = addDaysStr(next, -1);
  const end = addDaysStr(mondayOfStr(lastDay), 6);
  const cells: string[] = [];
  for (let d = start; d <= end; d = addDaysStr(d, 1)) cells.push(d);
  return cells;
}

/**
 * Calendário mensal compacto pra saltar pra uma data distante. Clicar num dia
 * leva a grade semanal pra semana dele; domingo é desabilitado (a clínica
 * não atende). "Hoje" mora ao lado das setas da semana, não aqui.
 */
function MonthPicker({
  selected,
  today,
  refreshKey,
  onSelect,
}: {
  selected: string;
  today: string;
  /** Muda quando a agenda é alterada (agendar/reagendar) pra recontar os dias. */
  refreshKey: number;
  onSelect: (date: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => firstOfMonthStr(selected));
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Navegar de semana pelas setas pode cruzar o mês — acompanha a seleção.
  useEffect(() => {
    setViewMonth(firstOfMonthStr(selected));
  }, [selected]);

  const cells = useMemo(() => monthCells(viewMonth), [viewMonth]);

  useEffect(() => {
    let cancelled = false;
    getEvaluationDayCountsAction(cells[0], cells[cells.length - 1]).then((res) => {
      if (!cancelled) setCounts(res.success ? res.counts : {});
    });
    return () => {
      cancelled = true;
    };
  }, [cells, refreshKey]);

  const selectedWeek = mondayOfStr(selected);

  return (
    <div className="mt-2 rounded-md border border-paper-line-strong bg-white p-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => setViewMonth((m) => addMonthsStr(m, -1))}
          className="h-7 w-7 rounded text-sm font-semibold text-ink-soft hover:bg-paper"
        >
          ‹
        </button>
        <span className="text-xs font-bold text-ink">{monthLabelStr(viewMonth)}</span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => setViewMonth((m) => addMonthsStr(m, 1))}
          className="h-7 w-7 rounded text-sm font-semibold text-ink-soft hover:bg-paper"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {MONTH_WEEKDAY_LABEL.map((l, i) => (
          <span key={i} className="pb-1 text-[10px] font-bold uppercase text-ink-faint">
            {l}
          </span>
        ))}
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === viewMonth.slice(0, 7);
          const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
          const isToday = date === today;
          const inSelectedWeek = mondayOfStr(date) === selectedWeek;
          return (
            <button
              key={date}
              type="button"
              disabled={isSunday}
              aria-label={`${brDate(date)}${counts[date] ? ` — ${counts[date]} avaliação(ões)` : ""}`}
              aria-current={isToday ? "date" : undefined}
              title={counts[date] ? `${counts[date]} avaliação(ões) agendada(s)` : undefined}
              onClick={() => onSelect(date)}
              className={`relative h-7 text-[11px] tabular-nums transition-colors ${
                isToday ? "rounded-md font-bold" : "hover:bg-paper"
              } ${isSunday ? "cursor-not-allowed opacity-40" : ""} ${inMonth ? "text-ink" : "text-ink-faint"}`}
              style={
                isToday
                  ? { background: "var(--color-accent)", color: "var(--color-bg)" }
                  : inSelectedWeek
                    ? { background: "var(--color-accent-100)" }
                    : undefined
              }
            >
              {Number(date.slice(8))}
              {counts[date] ? (
                <span
                  aria-hidden
                  className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ background: isToday ? "var(--color-bg)" : "var(--color-accent)" }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-ink-faint">Ponto = dia com avaliação agendada.</p>
    </div>
  );
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

/**
 * Janelas LIVRES (em minutos desde 00:00) dentro do expediente comercial de
 * um dia específico, a partir dos blocos de disponibilidade cadastrados do
 * avaliador (day_of_week: 0=domingo..6=sábado; dayIndex do grid: 0=Seg..5=Sáb).
 * Blocos do mesmo dia são mesclados (podem vir soltos e fora de ordem).
 */
function freeWindowsForDay(blocks: TherapistAvailabilityBlock[], dayIndex: number, businessStart: number, businessEnd: number): [number, number][] {
  const dayOfWeek = dayIndex + 1; // grid Seg=0 -> dow=1 ... Sáb=5 -> dow=6
  const dayBlocks = blocks
    .filter((b) => b.dayOfWeek === dayOfWeek)
    .map((b): [number, number] => [Math.max(businessStart, parseTimeToMinutes(b.startTime)), Math.min(businessEnd, parseTimeToMinutes(b.endTime))])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [s, e] of dayBlocks) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

/** Complemento das janelas livres dentro de [businessStart, businessEnd) — o que deve aparecer "bloqueado" na grade. */
function blockedRangesForDay(freeWindows: [number, number][], businessStart: number, businessEnd: number): [number, number][] {
  const blocked: [number, number][] = [];
  let cursor = businessStart;
  for (const [s, e] of freeWindows) {
    if (s > cursor) blocked.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < businessEnd) blocked.push([cursor, businessEnd]);
  return blocked;
}

type DragPayload =
  | { kind: "pool"; poolItemId: string }
  | { kind: "reschedule"; appointmentId: string; durationMinutes: number };

/** Prévia do bloco sob o cursor durante o arraste — verde = pode soltar, vermelho = `error`. */
type DragPreview = { dayIndex: number; time: string; durationMinutes: number; kind: DragPayload["kind"]; error: string | null };

/** Diálogo de confirmação — alimentado pelo drop, pelo clique num horário vazio ou pelo botão "Agendar". */
type SlotDialog = { itemId: string; date: string; time: string };

function ScheduleDialog({
  dialog,
  readyPool,
  weekDays,
  rooms,
  roomId,
  error,
  pending,
  onChange,
  onRoomChange,
  onConfirm,
  onSuggest,
  onClose,
}: {
  dialog: SlotDialog;
  readyPool: EvaluationPoolItem[];
  weekDays: string[];
  rooms: { id: string; name: string }[];
  roomId: string;
  error: string | null;
  pending: boolean;
  onChange: (next: SlotDialog) => void;
  onRoomChange: (id: string) => void;
  onConfirm: () => void;
  /** Preenche data e horário com o primeiro horário vago a partir de amanhã. */
  onSuggest: () => void;
  onClose: () => void;
}) {
  const dayIndex = weekDays.indexOf(dialog.date);
  const closingMinutes = CLOSING_HOUR_BY_DAY[Math.max(0, dayIndex)] * 60;
  const timeOptions = Array.from({ length: TOTAL_MINUTES / ROW_MINUTES }, (_, i) => DAY_START_HOUR * 60 + i * ROW_MINUTES)
    .filter((start) => start + EVALUATION_DURATION_MINUTES <= closingMinutes)
    .map(minutesToTime);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fieldLabel = "text-[11px] font-semibold uppercase tracking-wide text-ink-soft";
  const selectedOffer = readyPool.find((p) => p.id === dialog.itemId)?.offer;
  const liveOffer = selectedOffer ? isLiveOffer(selectedOffer) : false;
  const recipient = readyPool.find((p) => p.id === dialog.itemId)?.recipient ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dialog-title"
        className="w-full max-w-sm rounded-lg border border-paper-line-strong bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="schedule-dialog-title" className="text-sm font-bold text-ink">
          Confirmar 1ª avaliação
        </h3>
        <div className="mt-3 flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Paciente</span>
            <select autoFocus value={dialog.itemId} onChange={(e) => onChange({ ...dialog, itemId: e.target.value })} className="input text-xs">
              {readyPool.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patientName}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Dia</span>
              <select value={dialog.date} onChange={(e) => onChange({ ...dialog, date: e.target.value })} className="input text-xs">
                {weekDays.map((d, i) => (
                  <option key={d} value={d}>
                    {WEEKDAY_LABEL[i]} {brDate(d).slice(0, 5)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Horário</span>
              <select value={dialog.time} onChange={(e) => onChange({ ...dialog, time: e.target.value })} className="input text-xs">
                {!timeOptions.includes(dialog.time) && <option value={dialog.time}>{dialog.time}</option>}
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={onSuggest}
            disabled={pending}
            className="btn text-xs font-semibold disabled:opacity-50"
            title="Primeiro horário vago a partir de amanhã"
          >
            Sugerir data mais próxima
          </button>
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Sala</span>
            <select value={roomId} onChange={(e) => onRoomChange(e.target.value)} className="input text-xs">
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-ink-faint">
            Duração: {EVALUATION_DURATION_MINUTES} min · O avaliador é definido automaticamente (menos avaliações na semana entre os livres).
          </p>
          {recipient ? (
            <p className="text-[11px] text-ink-soft">
              <span className="font-semibold">Aviso por WhatsApp:</span> {recipient.name ?? "Responsável"} · {recipient.phone}. Sai ao confirmar.
            </p>
          ) : (
            <p role="alert" className="rounded-md border border-amber-400 bg-amber-100 px-2 py-1.5 text-[11px] font-semibold text-amber-900">
              Sem telefone do responsável: a confirmação não será enviada. Avise a família manualmente.
            </p>
          )}
          {liveOffer && (
            <p role="alert" className="rounded-md border border-amber-400 bg-amber-100 px-2 py-1.5 text-[11px] font-semibold text-amber-900">
              O responsável está no fluxo automático do WhatsApp. Agendar manualmente cancela esse fluxo.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs font-semibold text-status-negative-text">
              {error}
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn text-xs">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!!error || pending}
            className="btn text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            {pending ? "Agendando…" : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditAppointmentDialog({
  appointment,
  rooms,
  pending,
  onSave,
  onCancelAppointment,
  onConfirmProvisional,
  onRejectOffer,
  onClose,
}: {
  appointment: EvaluationCalendarAppointment;
  rooms: { id: string; name: string }[];
  pending: boolean;
  onSave: (date: string, time: string, roomId: string) => Promise<void>;
  onCancelAppointment: () => Promise<void>;
  onConfirmProvisional?: () => Promise<void>;
  /** Só quando o horário veio da oferta automática: recusa, libera a vaga e reenvia as opções ao responsável. */
  onRejectOffer?: () => Promise<void>;
  onClose: () => void;
}) {
  const initialDate = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: CLINIC_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(appointment.startsAt));
  }, [appointment.startsAt]);

  const initialTime = useMemo(() => {
    return timeLabel(appointment.startsAt, CLINIC_TIMEZONE);
  }, [appointment.startsAt]);

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [roomId, setRoomId] = useState(appointment.roomId || rooms[0]?.id || "");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const timeOptions = useMemo(() => {
    const list: string[] = [];
    for (let h = DAY_START_HOUR; h <= GRID_END_HOUR; h++) {
      list.push(`${String(h).padStart(2, "0")}:00`);
      if (h < GRID_END_HOUR) list.push(`${String(h).padStart(2, "0")}:30`);
    }
    return list;
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fieldLabel = "text-[11px] font-semibold uppercase tracking-wide text-ink-soft";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-dialog-title"
        className="w-full max-w-md rounded-lg border border-paper-line-strong bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-paper-line pb-3">
          <div>
            <h3 id="edit-dialog-title" className="text-sm font-bold text-ink">
              Editar 1ª Avaliação
            </h3>
            <p className="text-xs font-semibold text-chart">{appointment.patientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Data</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={fieldLabel}>Horário de início</span>
              <select value={time} onChange={(e) => setTime(e.target.value)} className="input text-xs">
                {!timeOptions.includes(time) && <option value={time}>{time}</option>}
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs text-ink-soft">
            <span className={fieldLabel}>Avaliador</span> {appointment.therapistName}
          </p>

          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Sala de atendimento</span>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input text-xs">
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <p className="text-[11px] text-ink-faint">
            Duração padrão: {EVALUATION_DURATION_MINUTES} min · Horário de término previsto:{" "}
            {minutesToTime(parseTimeToMinutes(time) + EVALUATION_DURATION_MINUTES)}.
          </p>
        </div>

        {appointment.isProvisional && onConfirmProvisional && (
          <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50/90 p-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 text-amber-950">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white shadow-xs">
                ⚡
              </span>
              <div>
                <p className="text-xs font-bold text-amber-950">Horário escolhido pela família via WhatsApp</p>
                <p className="text-[11px] text-amber-800">Aguardando sua confirmação para finalizar o agendamento.</p>
              </div>
            </div>
            <p className="mt-2 rounded border border-amber-200 bg-amber-100/70 p-2 text-[11px] font-medium text-amber-900">
              💬 Ao clicar em <strong>Confirmar e Enviar WhatsApp</strong>, o agendamento é confirmado no sistema e uma mensagem com as orientações completas (documentos necessários, antecedência, etc.) é enviada automaticamente para o WhatsApp do responsável.
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {appointment.offerId && onRejectOffer && (
                <button
                  type="button"
                  onClick={onRejectOffer}
                  disabled={pending}
                  className="btn text-xs font-semibold disabled:opacity-50"
                  title="Libera esta vaga e envia novas opções de horário ao responsável"
                >
                  Recusar e reofertar
                </button>
              )}
              <button
                type="button"
                onClick={onConfirmProvisional}
                disabled={pending}
                className="btn flex items-center gap-1.5 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" />
                {pending ? "Confirmando e enviando..." : "Confirmar e Enviar WhatsApp"}
              </button>
            </div>
          </div>
        )}

        {confirmCancel ? (
          <div className="mt-4 rounded-md border border-status-negative-text/30 bg-status-negative-soft/40 p-3">
            <p className="text-xs font-semibold text-status-negative-text">
              Deseja desmarcar esta avaliação e retornar {appointment.patientName} para a lista de pacientes aguardando agendamento?
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={pending}
                className="btn text-xs"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={onCancelAppointment}
                disabled={pending}
                className="btn text-xs font-semibold text-white bg-status-negative-text hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Desmarcando…" : "Sim, desmarcar avaliação"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-between border-t border-paper-line pt-3">
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={pending}
              className="text-xs font-semibold text-status-negative-text hover:underline disabled:opacity-50"
            >
              Desmarcar / Voltar para fila
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={pending} className="btn text-xs">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onSave(date, time, roomId)}
                disabled={pending || !date || !time || !roomId}
                className="btn text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
              >
                {pending ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EvaluationCalendar({
  pool: initialPool,
  offers: initialOffers,
  therapists,
  rooms,
}: {
  pool: EvaluationPoolItem[];
  offers: EvaluationOfferItem[];
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
}) {
  const [weekAnchor, setWeekAnchor] = useState(() => todayInTimeZone(CLINIC_TIMEZONE));
  const [appointments, setAppointments] = useState<EvaluationCalendarAppointment[]>([]);
  // Fechamentos cadastrados (clinic_closures) da semana visível; feriados
  // nacionais vêm de lib/clinic-calendar-pure, sem ida ao banco.
  const [closures, setClosures] = useState<ClinicClosure[]>([]);
  const [pool, setPool] = useState(initialPool);
  // Crianças que receberam a oferta automática por WhatsApp e ainda não têm horário (barra lateral).
  const [offers, setOffers] = useState(initialOffers);
  // Cards que o responsável acabou de escolher (aguardando OK): piscam por 2 min.
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmationItem[]>([]);
  // Relógio da tela (1 min) pra "há X h" das ofertas sem render impuro.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [countsVersion, setCountsVersion] = useState(0);
  const { toast } = useToast();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  // União das janelas de todos os avaliadores.
  const [availabilityBlocks, setAvailabilityBlocks] = useState<TherapistAvailabilityBlock[]>([]);
  // dataTransfer.getData() não é legível no dragover (só no drop) — o
  // payload fica num ref pra prévia saber a duração e o tipo do arraste.
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [slotDialog, setSlotDialog] = useState<SlotDialog | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<EvaluationCalendarAppointment | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  // Janela flutuante do card clicado na fila (laudo/guia/contato + aprovar,
  // rejeitar e mensagem) — guarda o retângulo do card pra ancorar a janela
  // ao lado dele.
  const [quickView, setQuickView] = useState<{ item: EvaluationPoolItem; rect: DOMRect } | null>(null);

  function openQuickView(item: EvaluationPoolItem, target: HTMLElement) {
    setQuickView({ item, rect: target.getBoundingClientRect() });
  }

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const week = useMemo(() => evaluationWeek(weekAnchor), [weekAnchor]);
  const bounds = useMemo(() => ({ start: week.days[0], end: addDaysStr(week.days[5], 1) }), [week]);

  // Sem avaliador cadastrado, a grade não tem destino válido pra receber um
  // agendamento — em vez de deixar o usuário arrastar/clicar em slots vazios
  // e só descobrir o erro depois do drop, a interação fica bloqueada e o
  // aviso aparece antes, com CTA direto pra cadastrar disponibilidade.
  const hasEvaluators = therapists.length > 0;

  async function fetchWeek(silent = false) {
    if (!silent) setLoading(true);
    const res = await getEvaluationCalendarWeekAction(bounds.start);
    if (res.success) {
      setAppointments(res.appointments);
      setClosures(res.closures);
      setCountsVersion((v) => v + 1);
    }
    if (!silent) setLoading(false);
  }

  async function fetchPool() {
    const res = await getEvaluationPoolAction();
    if (res.success) {
      setPool(res.pool);
      setOffers(res.offers);
      if ("pendingConfirmations" in res && res.pendingConfirmations) {
        setPendingConfirmations(res.pendingConfirmations);
      }
    }
  }

  // Tempo real: o responsável escolhe o horário no WhatsApp e a agenda reage
  // sem recarregar. Escuta a oferta (evaluation_offers) e os agendamentos de
  // avaliação; com a aba aberta o poll de 60s e o retorno à aba cobrem uma
  // assinatura que caiu (mesmo desenho de app/recepcao/chegadas/chegadas-list.tsx).
  const refreshRef = useRef<() => void>(() => {});
  // Atualizado a cada render (a closure enxerga a semana atual) — fora do corpo
  // do render pra não escrever em ref durante ele.
  useEffect(() => {
    refreshRef.current = () => {
      void fetchWeek(true);
      void fetchPool();
    };
  });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = () => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      refreshRef.current();
    }, 1500);
  };

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("evaluation-offers-agenda")
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluation_offers" }, (payload) => {
        const next = payload.new as { status?: string; appointment_id?: string | null } | undefined;
        if (payload.eventType === "UPDATE" && next?.status === "aguardando_supervisor" && next.appointment_id) {
          const appointmentId = next.appointment_id;
          setFlashIds((prev) => new Set(prev).add(appointmentId));
          setTimeout(
            () =>
              setFlashIds((prev) => {
                const copy = new Set(prev);
                copy.delete(appointmentId);
                return copy;
              }),
            120_000,
          );
          toast("Um responsável escolheu o horário da 1ª avaliação — confira o card piscando na agenda e confirme.", "info");
        }
        scheduleRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: "is_evaluation=eq.true" }, () => scheduleRefresh())
      .subscribe();

    const interval = setInterval(() => {
      setNowMs(Date.now());
      if (!document.hidden) refreshRef.current();
    }, 60_000);
    const onVisibility = () => {
      if (!document.hidden) refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runOfferAction(run: () => Promise<{ success: boolean; error?: string }>, okMessage: string) {
    const res = await run();
    if (!res.success) {
      toast(res.error ?? "Não foi possível concluir.", "error");
      return;
    }
    toast(okMessage, "success");
    await fetchPool();
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchWeek();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start]);

  useEffect(() => {
    let cancelled = false;
    getEvaluatorsAvailabilityAction().then((res) => {
      if (cancelled) return;
      setAvailabilityBlocks(res.success ? res.blocks : []);
    });
    void fetchPool();
    return () => {
      cancelled = true;
    };
  }, []);

  const readyPool = pool.filter((p) => p.ready);
  // Com oferta viva o responsável é quem agenda (WhatsApp): o card vira só acompanhamento
  // e sai do agendamento manual (botão, arrastar, clique na grade) até a oferta ser assumida.
  const hasLiveOffer = (p: EvaluationPoolItem) => Boolean(p.offer && isLiveOffer(p.offer));
  const schedulablePool = readyPool.filter((p) => !hasLiveOffer(p));
  const waitingPool = pool.filter((p) => !p.ready);
  // Ofertas cujo paciente não aparece na fila (o card da fila já mostra a faixa de status).
  const orphanOffers = offers.filter((o) => !pool.some((p) => p.offer?.id === o.id));

  // Avaliador sem bloco cadastrado não atende (allocateEvaluator ignora): a
  // grade pinta como livre só a união das janelas cadastradas.
  const hasAvailabilityConfigured = availabilityBlocks.length > 0;
  const blockedRangesByDay = useMemo(() => {
    if (!hasAvailabilityConfigured) return [] as [number, number][][];
    return week.days.map((_, dayIndex) => {
      const businessStart = DAY_START_HOUR * 60;
      const businessEnd = CLOSING_HOUR_BY_DAY[dayIndex] * 60;
      const free = freeWindowsForDay(availabilityBlocks, dayIndex, businessStart, businessEnd);
      return blockedRangesForDay(free, businessStart, businessEnd);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityBlocks, hasAvailabilityConfigured, week.days.length]);

  function computeTimeFromOffsetY(offsetY: number): string {
    const rawMinutes = (offsetY / ROW_HEIGHT_PX) * ROW_MINUTES;
    // floor = o slot sob o cursor. Com round, 08:00 só valia nos 14px de cima da
    // grade (a borda, onde o cursor quase nunca cai) e 08:30 "roubava" a faixa.
    const snapped = Math.max(0, Math.min(TOTAL_MINUTES - ROW_MINUTES, Math.floor(rawMinutes / ROW_MINUTES) * ROW_MINUTES));
    return minutesToTime(DAY_START_HOUR * 60 + snapped);
  }

  /**
   * Mesma regra pra prévia do arraste, clique na grade e diálogo — o erro
   * aparece ANTES de soltar/confirmar, não depois. Disponibilidade do
   * avaliador só vale pra novo agendamento: reagendar mantém o terapeuta
   * original do compromisso, que pode não ser o selecionado agora.
   */
  function validateSlot(dayIndex: number, time: string, kind: DragPayload["kind"], durationMinutes: number): string | null {
    if (dayIndex < 0) return "Escolha um dia da semana visível.";
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + durationMinutes;
    const calendarClosed = closureReason(week.days[dayIndex], startMinutes, endMinutes, closures);
    if (calendarClosed) return `Clínica fechada: ${calendarClosed.label}.`;
    const closingHour = CLOSING_HOUR_BY_DAY[dayIndex];
    if (endMinutes > closingHour * 60) {
      return dayIndex === 5
        ? "Sábado o atendimento vai só até 12h — escolha um horário que termine até lá."
        : `Fora do horário de atendimento — encerra às ${closingHour}h.`;
    }
    if (kind === "pool" && hasAvailabilityConfigured) {
      const isBlocked = blockedRangesByDay[dayIndex]?.some(([s, e]) => startMinutes < e && endMinutes > s);
      if (isBlocked) return "Nenhum avaliador atende nesse horário (fora da disponibilidade cadastrada).";
    }
    return null;
  }

  function clearDrag() {
    dragPayloadRef.current = null;
    setDragPreview(null);
  }

  function updatePreview(dayIndex: number, offsetY: number) {
    const payload = dragPayloadRef.current;
    if (!payload) return;
    const time = computeTimeFromOffsetY(offsetY);
    const durationMinutes = payload.kind === "reschedule" ? payload.durationMinutes : EVALUATION_DURATION_MINUTES;
    // dragover dispara dezenas de vezes por segundo — só re-renderiza quando o slot muda.
    setDragPreview((prev) =>
      prev && prev.dayIndex === dayIndex && prev.time === time
        ? prev
        : { dayIndex, time, durationMinutes, kind: payload.kind, error: validateSlot(dayIndex, time, payload.kind, durationMinutes) },
    );
  }

  /**
   * `previous` presente = reagendamento reversível: o toast ganha "Desfazer",
   * que volta pro dia/horário original sem pedir confirmação a cada arraste.
   * O desfazer em si não passa `previous` — não encadeia desfazer de desfazer.
   */
  async function performReschedule(
    appointmentId: string,
    date: string,
    time: string,
    durationMinutes: number,
    previous?: { date: string; time: string },
  ) {
    const res = await rescheduleEvaluationAction(appointmentId, date, time, durationMinutes);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    await fetchWeek();
    const undo = previous
      ? () => {
          void performReschedule(appointmentId, previous.date, previous.time, durationMinutes);
        }
      : undefined;
    if (res.requiresFamilyNotice) {
      toast("Reagendamento feito — avise o responsável pelo WhatsApp, isso não é enviado automaticamente.", "info", undo, 10000);
    } else {
      toast(previous ? "Avaliação reagendada." : "Reagendamento desfeito.", "success", undo, 8000);
    }
  }

  async function handleDrop(dayIndex: number, offsetY: number, payload: DragPayload) {
    const date = week.days[dayIndex];
    const time = computeTimeFromOffsetY(offsetY);
    const durationMinutes = payload.kind === "reschedule" ? payload.durationMinutes : EVALUATION_DURATION_MINUTES;
    const error = validateSlot(dayIndex, time, payload.kind, durationMinutes);
    if (error) {
      toast(error, "error");
      return;
    }

    if (payload.kind === "pool") {
      // Soltar não grava: abre a confirmação com avaliador e sala à vista —
      // antes o par vinha escondido dos selects do topo (sala = 1ª da lista).
      setSlotDialog({ itemId: payload.poolItemId, date, time });
      return;
    }

    const appointment = appointments.find((a) => a.id === payload.appointmentId);
    if (!appointment) return;
    // Sem confirmação prévia: arrastar um card já marcado grava direto e o
    // toast oferece "Desfazer" (padrão Gmail/Google Calendar) — atrito zero
    // no caso comum, reversão de um clique no erro.
    const previousDayIndex = dayIndexInWeek(appointment.startsAt, week, CLINIC_TIMEZONE);
    if (previousDayIndex < 0) {
      await performReschedule(payload.appointmentId, date, time, payload.durationMinutes);
      return;
    }
    await performReschedule(payload.appointmentId, date, time, payload.durationMinutes, {
      date: week.days[previousDayIndex],
      time: timeLabel(appointment.startsAt, CLINIC_TIMEZONE),
    });
  }

  function handleGridClick(dayIndex: number, offsetY: number) {
    if (!hasEvaluators) return;
    if (schedulablePool.length === 0) {
      toast(
        readyPool.length > 0
          ? "Os pacientes da fila estão no agendamento automático pelo WhatsApp. Use \"Assumir manualmente\" no card para agendar você mesmo."
          : "Nenhum paciente pronto para agendar na fila.",
        "info",
      );
      return;
    }
    const time = computeTimeFromOffsetY(offsetY);
    const error = validateSlot(dayIndex, time, "pool", EVALUATION_DURATION_MINUTES);
    if (error) {
      toast(error, "error");
      return;
    }
    setSlotDialog({ itemId: schedulablePool[0].id, date: week.days[dayIndex], time });
  }

  function openDialogFromCard(item: EvaluationPoolItem) {
    const date = week.days.includes(today) ? today : week.days[0];
    setSlotDialog({ itemId: item.id, date, time: minutesToTime(DAY_START_HOUR * 60) });
    // Abre já na data mais próxima possível (primeiro horário vago a partir de amanhã).
    void applyNearestSuggestion(true);
  }

  /**
   * Regra da data mais próxima: preenche o diálogo com o primeiro horário vago
   * a partir de amanhã. Muda a semana exibida se a data cair
   * em outra semana (o seletor de data só lista a semana visível). Quando
   * `silent`, uma falha não incomoda: o diálogo segue com o padrão de sempre.
   */
  async function applyNearestSuggestion(silent: boolean) {
    const res = await suggestNearestEvaluationSlotAction();
    if (!res.success) {
      if (!silent) toast(res.error, "info");
      return;
    }
    setWeekAnchor(res.date);
    setSlotDialog((prev) => (prev ? { ...prev, date: res.date, time: res.time } : prev));
    if (!silent) toast(`Sugestão: ${res.label}.`, "success");
  }

  const dialogError = slotDialog
    ? !slotDialog.itemId
      ? "Escolha o paciente."
      : !roomId
        ? "Selecione a sala."
        : validateSlot(week.days.indexOf(slotDialog.date), slotDialog.time, "pool", EVALUATION_DURATION_MINUTES)
    : null;

  async function confirmSchedule() {
    if (!slotDialog || dialogError) return;
    const item = pool.find((p) => p.id === slotDialog.itemId);
    if (!item) return;
    setScheduling(true);
    const res = await scheduleFromPoolAction(item.bookInput, roomId, slotDialog.date, slotDialog.time);
    setScheduling(false);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    if (res.warning) {
      toast(`${item.patientName} agendado(a), mas o responsável NÃO foi avisado: ${res.warning} Avise pelo WhatsApp.`, "error", undefined, 10000);
    } else {
      toast(`${item.patientName} agendado(a) para ${brDate(slotDialog.date)} às ${slotDialog.time}.`, "success");
    }
    setSlotDialog(null);
    await Promise.all([fetchWeek(), fetchPool()]);
  }

  const weekNavButton = "h-8 rounded-md border border-paper-line-strong px-2.5 text-sm font-semibold text-ink-soft hover:bg-paper";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Semana anterior" onClick={() => setWeekAnchor((d) => addDaysStr(d, -7))} className={weekNavButton}>
            ‹
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor(today)}
            disabled={week.days.includes(today)}
            className={`${weekNavButton} text-xs disabled:cursor-default disabled:opacity-50`}
          >
            Hoje
          </button>
          <button type="button" aria-label="Próxima semana" onClick={() => setWeekAnchor((d) => addDaysStr(d, 7))} className={weekNavButton}>
            ›
          </button>
          <span className="ml-1 text-sm font-bold text-ink">{week.rangeLabel}</span>
        </div>

        {hasEvaluators ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="eval-room" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Sala
            </label>
            <select id="eval-room" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input text-xs">
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Link href="/supervisao/disponibilidade" className="text-xs font-semibold text-accent underline underline-offset-2 hover:no-underline">
              Disponibilidade do avaliador
            </Link>
          </div>
        ) : null}
      </div>

      {!hasEvaluators && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          style={{ background: "var(--status-falta-bg)", borderColor: "var(--color-status-negative-text)" }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} aria-hidden style={{ color: "var(--color-status-negative-text)" }} className="mt-0.5 shrink-0" />
            <p className="text-xs font-semibold" style={{ color: "var(--color-status-negative-text)" }}>
              Nenhum terapeuta avaliador disponível para esta data. Cadastre ou vincule a disponibilidade de um profissional para liberar a agenda.
            </p>
          </div>
          <Link
            href="/supervisao/disponibilidade"
            className="btn shrink-0 text-xs font-semibold"
            style={{ background: "var(--color-status-negative-text)", color: "#fff" }}
          >
            Disponibilidade do avaliador
          </Link>
        </div>
      )}

      {hasEvaluators && (
        <p className="text-[11px] text-ink-faint">
          {hasAvailabilityConfigured ? (
            <>
              <span style={{ color: "var(--color-success)" }} className="font-semibold">Verde</span> é horário em que algum avaliador atende,{" "}
              <span style={{ color: "var(--color-error)" }} className="font-semibold">vermelho</span> é fora do expediente ou fechado.
            </>
          ) : (
            <>Avaliador sem disponibilidade cadastrada — vale só o horário comercial.</>
          )}{" "}
          Clique num horário vazio ou arraste um paciente: o sistema escolhe o avaliador.
        </p>
      )}

      {pendingConfirmations.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-lg text-white shadow-xs animate-bounce">
                ⚡
              </span>
              <div>
                <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  {pendingConfirmations.length === 1
                    ? "1 agendamento escolhido pela família aguardando confirmação"
                    : `${pendingConfirmations.length} agendamentos escolhidos pela família aguardando confirmação`}
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">
                    Ação Necessária
                  </span>
                </h4>
                <p className="mt-0.5 text-xs text-amber-800">
                  Os responsáveis já escolheram a data via WhatsApp. Clique em <strong>Confirmar</strong> para aprovar a vaga e enviar a notificação com as orientações à família.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2.5 border-t border-amber-200">
            {pendingConfirmations.map((p) => {
              const dt = new Date(p.startsAt);
              const dateFormatted = dt.toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE, weekday: "short", day: "2-digit", month: "2-digit" });
              const timeFormatted = timeLabel(p.startsAt, CLINIC_TIMEZONE);
              return (
                <div
                  key={p.appointmentId}
                  className="flex items-center justify-between gap-3 rounded-lg border-2 border-amber-300 bg-white p-3 shadow-xs hover:border-amber-500 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{p.patientName}</p>
                    <p className="text-[11px] font-semibold text-amber-900">
                      📅 {dateFormatted} às {timeFormatted}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      👤 {p.therapistName} · {p.roomName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAppointment({
                        id: p.appointmentId,
                        patientId: p.patientId,
                        patientName: p.patientName,
                        startsAt: p.startsAt,
                        endsAt: p.endsAt,
                        therapistName: p.therapistName,
                        roomId: p.roomId,
                        roomName: p.roomName,
                        isProvisional: true,
                        offerId: p.offerId,
                      });
                    }}
                    className="btn shrink-0 flex items-center gap-1.5 text-xs font-bold text-white shadow-xs bg-amber-600 hover:bg-amber-700"
                    title="Clique para abrir e confirmar o agendamento"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Confirmar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* Fila lateral — origem do agendamento vem antes da navegação por mês. */}
        <aside className="w-64 shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Prontos para agendar ({readyPool.length})</h3>
          <p className="mb-2 mt-0.5 text-[10px] text-ink-faint">Cards com faixa colorida seguem o agendamento automático pelo WhatsApp: nada a fazer, o horário aparece na agenda para você confirmar. Nos demais, clique para ver documentos e arraste para a grade ou use Agendar.</p>
          <div className="flex flex-col gap-2">
            {readyPool.map((item) => {
              const automatic = hasLiveOffer(item);
              const canSchedule = hasEvaluators && !automatic;
              return (
              <div
                key={item.id}
                draggable={canSchedule}
                role="button"
                tabIndex={0}
                onDragStart={(e) => {
                  if (!canSchedule) {
                    e.preventDefault();
                    return;
                  }
                  const payload: DragPayload = { kind: "pool", poolItemId: item.id };
                  dragPayloadRef.current = payload;
                  e.dataTransfer.setData("application/json", JSON.stringify(payload));
                }}
                onDragEnd={clearDrag}
                onClick={(e) => openQuickView(item, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openQuickView(item, e.currentTarget);
                  }
                }}
                className={`grid-cell-focusable rounded-md border border-paper-line-strong bg-white p-2.5 shadow-sm hover:border-[var(--color-accent)] ${
                  canSchedule ? "cursor-grab active:cursor-grabbing" : automatic ? "cursor-pointer" : "cursor-pointer opacity-70"
                }`}
                title={
                  automatic
                    ? "Agendamento automático em andamento — o responsável escolhe o horário pelo WhatsApp. Clique para consulta rápida."
                    : hasEvaluators
                      ? "Clique para consulta rápida (laudo, guia, contato) · arraste para a grade para agendar"
                      : "Clique para consulta rápida — cadastre um terapeuta avaliador para liberar o agendamento"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-ink">{item.patientName}</p>
                  {canSchedule && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDialogFromCard(item);
                        }}
                        title="Só use se for agendar por conta própria: o responsável não precisa de autorização sua para escolher o horário"
                        className="text-[10px] font-medium text-ink-faint underline underline-offset-2 hover:text-ink-soft hover:no-underline"
                      >
                        Agendar manualmente
                      </button>
                    </div>
                  )}
                </div>
                {item.offer && <OfferStatusBand badge={offerBadge(item.offer, nowMs)} />}
                {automatic && item.offer && (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-ink-faint">Nada a fazer: você confirma quando o horário aparecer na agenda.</p>
                    <button
                      type="button"
                      className="shrink-0 text-[10px] font-semibold text-ink-soft underline underline-offset-2 hover:no-underline"
                      title="Cancela o envio automático ao responsável para você agendar manualmente"
                      onClick={(e) => {
                        e.stopPropagation();
                        const offerId = item.offer!.id;
                        if (!window.confirm("Cancelar o agendamento automático e agendar manualmente? O responsável deixa de receber as opções por WhatsApp.")) return;
                        void runOfferAction(() => cancelEvaluationOfferAction(offerId), "Oferta cancelada. Agende manualmente.");
                      }}
                    >
                      Assumir manualmente
                    </button>
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.gate ? (
                    // Na fila de prontos todo gate é "habilitado": um chip só, sem a categoria "Docs · Recepção".
                    <span
                      className="tag-status st-confirmada"
                      title="A Recepção conferiu os documentos, o plano autorizou e o agendamento foi habilitado"
                    >
                      ✓ Docs OK
                    </span>
                  ) : item.facts ? (
                    <PoolFactsChips facts={item.facts} />
                  ) : (
                    <OriginChip origin={item.origin} />
                  )}
                </div>
                {!item.facts || item.gate ? <p className="mt-1 text-[11px] text-ink-faint">{item.detail}</p> : null}
                {!item.offer && item.bookInput.origin === "presencial" && (
                  <p className="mt-1 text-[10px] text-ink-faint">Convite automático por WhatsApp ainda não enviado.</p>
                )}
              </div>
              );
            })}
            {readyPool.length === 0 && <p className="text-xs text-ink-faint">Nenhum paciente pronto para agendar.</p>}
          </div>

          {orphanOffers.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-soft">Aguardando responsável ({orphanOffers.length})</h3>
              <p className="mb-2 mt-0.5 text-[10px] text-ink-faint">Receberam as opções de horário por WhatsApp e ainda não escolheram.</p>
              <div className="flex flex-col gap-2">
                {orphanOffers.map((o) => {
                  const problem = o.status === "falhou" || o.status === "sem_horario";
                  const hours = o.sentAt ? Math.floor((nowMs - new Date(o.sentAt).getTime()) / 3_600_000) : null;
                  const late = !problem && hours !== null && hours >= 24;
                  const statusText =
                    o.status === "aguardando_interesse"
                      ? "Aguardando resposta ao convite"
                      : o.status === "aguardando_escolha"
                        ? "Escolhendo o horário"
                        : o.status === "falhou"
                          ? "Falha no envio"
                          : "Sem horário livre";
                  return (
                    <div
                      key={o.id}
                      className={`rounded-md border p-2.5 ${problem ? "border-status-negative-text/40 bg-status-negative-soft/30" : late ? "border-amber-400 bg-[#fff9eb]" : "border-paper-line-strong bg-paper"}`}
                    >
                      <p className="text-xs font-semibold text-ink">{o.patientName}</p>
                      <p className="mt-1 text-[11px] text-ink-soft">
                        {statusText}
                        {hours !== null && !problem ? ` · há ${hours < 1 ? "menos de 1" : hours} h${late ? " (lembrete enviado)" : ""}` : ""}
                      </p>
                      {problem && o.lastError && <p className="mt-1 text-[11px] text-status-negative-text">{o.lastError}</p>}
                      <div className="mt-2 flex gap-1.5">
                        {problem ? (
                          <button
                            type="button"
                            className="btn text-[11px]"
                            onClick={() => runOfferAction(() => restartEvaluationOfferAction(o.patientId), "Nova tentativa enviada ao responsável.")}
                          >
                            Tentar de novo
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn text-[11px]"
                            title="Cancela a oferta automática para você agendar manualmente"
                            onClick={() => runOfferAction(() => cancelEvaluationOfferAction(o.id), "Oferta cancelada. Agende manualmente.")}
                          >
                            Cancelar oferta
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {waitingPool.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-soft">Aguardando liberação ({waitingPool.length})</h3>
              <p className="mb-2 mt-0.5 text-[10px] text-ink-faint">Ainda não podem ser agendados — aprovação ou OK da Recepção pendente.</p>
              <div className="flex flex-col gap-2">
                {waitingPool.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => openQuickView(item, e.currentTarget)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      openQuickView(item, e.currentTarget);
                    }}
                    className="cursor-pointer rounded-md border border-dashed border-paper-line-strong bg-paper p-2.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    title={
                      item.gate
                        ? "Clique para ver os documentos — a Recepção libera o agendamento na Fila de pendências"
                        : "Clique para ver os documentos e aprovar, rejeitar ou enviar mensagem"
                    }
                  >
                    <p className="text-xs font-semibold text-ink">{item.patientName}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.gate ? null : item.facts ? <PoolFactsChips facts={item.facts} /> : <OriginChip origin={item.origin} />}
                      <span
                        className="tag-status st-agendada"
                        aria-label={item.gate ? "Aguardando o ok da Recepção" : "Documentação pendente de aprovação"}
                      >
                        {item.gate ? "Aguardando OK da Recepção" : "Aguardando Aprovação"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {item.gate ? `${item.statusLabel} — a Recepção libera antes de agendar.` : `${item.statusLabel} — aprove antes de agendar.`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-ink-soft">Ir para data</summary>
            <MonthPicker selected={weekAnchor} today={today} refreshKey={countsVersion} onSelect={setWeekAnchor} />
          </details>
        </aside>

        {quickView && (
          <EvaluationQuickViewPanel
            key={quickView.item.id}
            item={quickView.item}
            anchorRect={quickView.rect}
            onClose={() => setQuickView(null)}
            onResolved={(text) => {
              setQuickView(null);
              toast(text, "success");
              fetchPool();
            }}
            onChanged={fetchPool}
          />
        )}

        {/* Grade semanal */}
        <div className={`relative flex-1 overflow-x-auto ${hasEvaluators ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!hasEvaluators}>
          {!hasEvaluators && !loading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-10">
              <p className="rounded-md border border-paper-line-strong bg-white px-3 py-2 text-xs font-semibold text-ink-soft shadow-sm">
                Agenda bloqueada até cadastrar um avaliador
              </p>
            </div>
          )}
          {/* Carregamento por cima da grade, sem desmontá-la — evita o salto de layout a cada troca de semana. */}
          {loading && (
            <div className="pointer-events-none absolute inset-x-0 top-8 z-20 flex justify-center">
              <p className="rounded-md border border-paper-line-strong bg-white px-3 py-1.5 text-xs text-ink-faint shadow-sm">Carregando semana…</p>
            </div>
          )}
          <div className={`flex transition-opacity ${loading ? "opacity-60" : ""}`} style={{ minWidth: 760 }}>
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
              const preview = dragPreview?.dayIndex === dayIndex ? dragPreview : null;
              // Dia inteiro fechado (feriado nacional ou fechamento sem janela de horário).
              const dayClosed = closureReason(day, 0, 24 * 60, closures);
              return (
                <div key={day} className="flex-1 border-l border-paper-line pl-1">
                  <div className="flex flex-col items-center pb-1 leading-tight">
                    <span className="text-[10px] font-bold uppercase text-ink-soft">{WEEKDAY_LABEL[dayIndex]}</span>
                    <span
                      title={brDate(day)}
                      aria-current={day === today ? "date" : undefined}
                      className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums text-ink"
                      style={day === today ? { background: "var(--color-accent)", color: "var(--color-bg)" } : undefined}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {dayClosed && (
                      <span className="mt-0.5 max-w-full truncate px-1 text-[9px] font-semibold text-status-negative-text" title={dayClosed.label}>
                        {dayClosed.label}
                      </span>
                    )}
                  </div>
                  <div
                    className={`relative rounded-md ${hasAvailabilityConfigured ? "" : "bg-paper"} ${hasEvaluators ? "cursor-pointer" : ""}`}
                    style={{
                      height: COLUMN_HEIGHT_PX,
                      background: hasAvailabilityConfigured ? "var(--status-confirmada-bg)" : undefined,
                    }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-appointment]")) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      handleGridClick(dayIndex, e.clientY - rect.top);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      updatePreview(dayIndex, e.clientY - rect.top);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                      setDragPreview((p) => (p?.dayIndex === dayIndex ? null : p));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      clearDrag();
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
                    {dayClosed && (
                      <div
                        className="pointer-events-none absolute inset-0 z-[1] flex items-start justify-center rounded-md pt-2 text-center text-[10px] font-semibold"
                        style={{
                          background:
                            "repeating-linear-gradient(135deg, var(--status-falta-bg) 0 8px, transparent 8px 16px)",
                          color: "var(--color-status-negative-text)",
                        }}
                      >
                        {dayClosed.label}
                      </div>
                    )}
                    {closedHeight > 0 && (
                      <div
                        className="pointer-events-none absolute left-0 right-0 flex items-start justify-center rounded-b-md pt-1 text-[10px] font-semibold"
                        style={{
                          top: closedTop,
                          height: closedHeight,
                          background: "var(--status-falta-bg)",
                          color: "var(--color-status-negative-text)",
                        }}
                      >
                        Fechado
                      </div>
                    )}
                    {hasAvailabilityConfigured &&
                      blockedRangesByDay[dayIndex]?.map(([startMin, endMin], i) => {
                        const top = ((startMin - DAY_START_HOUR * 60) / ROW_MINUTES) * ROW_HEIGHT_PX;
                        const height = ((endMin - startMin) / ROW_MINUTES) * ROW_HEIGHT_PX;
                        return (
                          <div
                            key={i}
                            className="pointer-events-none absolute left-0 right-0 flex items-start justify-center pt-1 text-[10px] font-semibold"
                            style={{
                              top,
                              height,
                              background: "var(--status-falta-bg)",
                              color: "var(--color-status-negative-text)",
                            }}
                          >
                            {height > 20 ? "Fora da disponibilidade" : ""}
                          </div>
                        );
                      })}
                    {dayAppointments.map((a) => {
                      const startMinutes = parseTimeToMinutes(timeLabel(a.startsAt, CLINIC_TIMEZONE)) - DAY_START_HOUR * 60;
                      const durationMinutes = Math.max(30, (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000);
                      const top = (startMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
                      const height = (durationMinutes / ROW_MINUTES) * ROW_HEIGHT_PX;
                      return (
                        <div
                          key={a.id}
                          data-appointment
                          draggable
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAppointment(a);
                          }}
                          onDragStart={(e) => {
                            const payload: DragPayload = { kind: "reschedule", appointmentId: a.id, durationMinutes };
                            dragPayloadRef.current = payload;
                            e.dataTransfer.setData("application/json", JSON.stringify(payload));
                          }}
                          className={`grid-cell-focusable absolute left-1 right-1 cursor-pointer overflow-hidden rounded-[14px] p-2 text-xs shadow-xs hover:ring-2 active:cursor-grabbing transition-all hover:scale-[1.01] ${
                            a.isProvisional
                              ? "border-2 border-amber-500 bg-[#fff9eb] ring-2 ring-amber-400/50 hover:ring-amber-500 shadow-md"
                              : "border border-[#4a6358] bg-[#fdf6e9] hover:ring-chart/50"
                          } ${flashIds.has(a.id) ? "animate-pulse ring-4 ring-amber-500" : ""}`}
                          style={{
                            top,
                            height,
                            background: a.isProvisional ? "#fff9eb" : "#fdf6e9",
                            borderColor: a.isProvisional ? "#f59e0b" : "#4a6358",
                          }}
                          title={`${a.patientName} · ${timeLabel(a.startsAt, CLINIC_TIMEZONE)} · ${a.therapistName} · ${a.roomName}${
                            a.isProvisional ? " (⏳ Aguardando aprovação do supervisor — clique para confirmar e enviar WhatsApp)" : ""
                          } — clique para editar/confirmar/desmarcar`}
                        >
                          <div className="flex items-center justify-between gap-1 leading-snug">
                            <p className="truncate font-bold text-slate-900 text-[12px]">{a.patientName}</p>
                            {a.isProvisional && (
                              <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-xs animate-pulse">
                                ⚡ PENDENTE
                              </span>
                            )}
                          </div>
                          <p className="truncate text-slate-700 text-[11px] mt-0.5 font-medium">
                            {timeLabel(a.startsAt, CLINIC_TIMEZONE)} · {a.therapistName}
                          </p>
                          {a.isProvisional && (
                            <div className="mt-1 flex items-center justify-between gap-1 rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 border border-amber-300">
                              <span className="flex items-center gap-1 truncate">
                                👉 Clique p/ confirmar
                              </span>
                              <span className="shrink-0 text-[9px] text-amber-800">💬 WhatsApp</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {preview && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border-2 border-dashed p-1 text-[10px] font-semibold leading-tight"
                        style={{
                          top: ((parseTimeToMinutes(preview.time) - DAY_START_HOUR * 60) / ROW_MINUTES) * ROW_HEIGHT_PX,
                          height: (preview.durationMinutes / ROW_MINUTES) * ROW_HEIGHT_PX,
                          background: preview.error ? "var(--status-falta-bg)" : "var(--color-accent-100)",
                          borderColor: preview.error ? "var(--color-status-negative-text)" : "var(--color-accent)",
                          color: preview.error ? "var(--color-status-negative-text)" : "var(--color-ink, inherit)",
                        }}
                      >
                        <p>
                          {preview.time}–{minutesToTime(parseTimeToMinutes(preview.time) + preview.durationMinutes)}
                        </p>
                        <p className="truncate font-normal">
                          {preview.error ?? (preview.kind === "pool" ? "Avaliador automático" : "Reagendar")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {slotDialog && (
        <ScheduleDialog
          dialog={slotDialog}
          readyPool={schedulablePool}
          weekDays={week.days}
          rooms={rooms}
          roomId={roomId}
          error={dialogError}
          pending={scheduling}
          onChange={setSlotDialog}
          onRoomChange={setRoomId}
          onConfirm={confirmSchedule}
          onSuggest={() => void applyNearestSuggestion(false)}
          onClose={() => setSlotDialog(null)}
        />
      )}

      {editingAppointment && (
        <EditAppointmentDialog
          appointment={editingAppointment}
          rooms={rooms}
          pending={pendingEdit}
          onSave={async (date, time, editRoomId) => {
            setPendingEdit(true);
            const res = await updateEvaluationAppointmentAction({
              appointmentId: editingAppointment.id,
              date,
              time,
              roomId: editRoomId,
            });
            setPendingEdit(false);
            if (!res.success) {
              toast(res.error, "error");
              return;
            }
            toast("Agendamento atualizado com sucesso.", "success");
            setEditingAppointment(null);
            await Promise.all([fetchWeek(), fetchPool()]);
          }}
          onCancelAppointment={async () => {
            setPendingEdit(true);
            const res = await cancelEvaluationAppointmentAction(editingAppointment.id);
            setPendingEdit(false);
            if (!res.success) {
              toast(res.error, "error");
              return;
            }
            toast(`${editingAppointment.patientName} desmarcado(a) e retornado(a) para a fila.`, "success");
            setEditingAppointment(null);
            await Promise.all([fetchWeek(), fetchPool()]);
          }}
          onConfirmProvisional={async () => {
            setPendingEdit(true);
            const res = await confirmEvaluationAppointmentAction(editingAppointment.id);
            setPendingEdit(false);
            if (!res.success) {
              toast(res.error, "error");
              return;
            }
            if (res.warning) {
              toast(`Agendamento de ${editingAppointment.patientName} confirmado, mas atenção: ${res.warning}`, "warning");
            } else {
              toast(`Agendamento de ${editingAppointment.patientName} confirmado! Notificação enviada por WhatsApp ao responsável.`, "success");
            }
            setEditingAppointment(null);
            await Promise.all([fetchWeek(), fetchPool()]);
          }}
          onRejectOffer={async () => {
            setPendingEdit(true);
            const res = await rejectEvaluationOfferAction(editingAppointment.id);
            setPendingEdit(false);
            if (!res.success) {
              toast(res.error, "error");
              return;
            }
            toast(`Horário recusado. ${editingAppointment.patientName}: novas opções enviadas ao responsável.`, "success");
            setEditingAppointment(null);
            await Promise.all([fetchWeek(), fetchPool()]);
          }}
          onClose={() => setEditingAppointment(null)}
        />
      )}
    </div>
  );
}
