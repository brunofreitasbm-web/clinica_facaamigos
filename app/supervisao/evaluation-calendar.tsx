"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { useToast } from "@/components/toast-provider";
import { dayIndexInWeek, timeLabel, type WeekInfo } from "./grade-data";
import {
  getEvaluationCalendarWeekAction,
  getEvaluationPoolAction,
  getTherapistAvailabilityAction,
  scheduleFromPoolAction,
  rescheduleEvaluationAction,
  type TherapistAvailabilityBlock,
} from "./evaluation-calendar-actions";
import type { EvaluationAgendaOrigin, EvaluationCalendarAppointment, EvaluationPoolItem } from "@/lib/evaluation-agenda";
import { EvaluationQuickViewPanel } from "./evaluation-quick-view";
import { AlertTriangle } from "lucide-react";

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
  convenio_pdf: "PDF de plano de saúde",
  presencial: "Presencial",
  family_meeting: "Reunião · Responsável",
  patient_feedback: "Devolutiva do paciente",
};

const ORIGIN_TAG: Record<EvaluationAgendaOrigin, string> = {
  whatsapp_anamnese: "st-agendada",
  convenio_pdf: "st-confirmada",
  presencial: "st-realizada",
  family_meeting: "st-em-atendimento",
  patient_feedback: "st-cancelada",
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
  const { toast } = useToast();
  const [therapistId, setTherapistId] = useState(therapists[0]?.id ?? "");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<TherapistAvailabilityBlock[]>([]);
  // Janela flutuante do card clicado na fila (laudo/guia/contato + aprovar,
  // rejeitar e mensagem) — guarda o retângulo do card pra ancorar a janela
  // ao lado dele.
  const [quickView, setQuickView] = useState<{ item: EvaluationPoolItem; rect: DOMRect } | null>(null);

  function openQuickView(item: EvaluationPoolItem, target: HTMLElement) {
    setQuickView({ item, rect: target.getBoundingClientRect() });
  }

  const week = useMemo(() => evaluationWeek(weekAnchor), [weekAnchor]);
  const bounds = useMemo(() => ({ start: week.days[0], end: addDaysStr(week.days[5], 1) }), [week]);

  // Une os terapeutas cadastrados como avaliadores com quem de fato aparece
  // agendado na semana visível — sem isso o dropdown pode dizer "nenhum
  // terapeuta avaliador cadastrado" enquanto o grid mostra agendamentos reais,
  // já que o agendamento em si não exige a flag is_evaluator.
  // Esses avulsos entram só para leitura do grid: `isEvaluator: false` os
  // desabilita como destino de NOVO agendamento — não é uma trava (o banco
  // aceitaria), é orientação: nem todo terapeuta é avaliador.
  const availableTherapists = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; isEvaluator: boolean }>(
      therapists.map((t) => [t.id, { ...t, isEvaluator: true }]),
    );
    for (const a of appointments) {
      if (!byId.has(a.therapistId))
        byId.set(a.therapistId, { id: a.therapistId, name: a.therapistName, isEvaluator: false });
    }
    return Array.from(byId.values());
  }, [therapists, appointments]);

  // Sem avaliador cadastrado, a grade não tem destino válido pra receber um
  // agendamento — em vez de deixar o usuário arrastar/clicar em slots vazios
  // e só descobrir o erro depois do drop, a interação fica bloqueada e o
  // aviso aparece antes, com CTA direto pra cadastrar disponibilidade.
  const hasEvaluators = availableTherapists.some((t) => t.isEvaluator);

  useEffect(() => {
    // Nunca pré-selecionar um avulso sem qualificação: ele só está na lista
    // para o grid, não como destino padrão de novo agendamento.
    if (!therapistId) {
      const first = availableTherapists.find((t) => t.isEvaluator);
      if (first) setTherapistId(first.id);
    }
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

  useEffect(() => {
    if (!therapistId) return;
    let cancelled = false;
    getTherapistAvailabilityAction(therapistId).then((res) => {
      if (!cancelled) setAvailabilityBlocks(res.success ? res.blocks : []);
    });
    return () => {
      cancelled = true;
    };
  }, [therapistId]);

  const quickViewScheduleLabel = (() => {
    const therapist = availableTherapists.find((t) => t.id === therapistId)?.name;
    const room = rooms.find((r) => r.id === roomId)?.name;
    return therapist && room ? `${therapist} · ${room}` : null;
  })();

  const readyPool = pool.filter((p) => p.ready);
  const waitingPool = pool.filter((p) => !p.ready);

  // Se o avaliador não tem NENHUM bloco cadastrado, disponibilidade ainda não
  // foi configurada pra ele — não restringe nada além do horário comercial,
  // mesmo comportamento do trigger appointments_availability_guard no banco.
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

    // Só valida contra a disponibilidade do dropdown em novos agendamentos —
    // reagendar um card já marcado mantém o terapeuta original do
    // compromisso, que pode não ser o selecionado no dropdown agora.
    if (payload.kind === "pool" && hasAvailabilityConfigured) {
      const startMinutes = parseTimeToMinutes(time);
      const isBlocked = blockedRangesByDay[dayIndex]?.some(([s, e]) => startMinutes < e && endMinutes > s);
      if (isBlocked) {
        setFeedback({
          type: "error",
          text: "Fora da disponibilidade cadastrada do avaliador para esse dia/horário — veja Disponibilidade no menu.",
        });
        return;
      }
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
      if (res.success) {
        await fetchWeek();
        if (res.requiresFamilyNotice) {
          toast("Reagendamento feito — avise o responsável pelo WhatsApp, isso não é enviado automaticamente.", "info", undefined, 10000);
        }
      }
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

        {hasEvaluators ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Terapeuta avaliador</label>
            <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="input text-xs">
              {availableTherapists.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.isEvaluator}>
                  {t.isEvaluator ? t.name : `${t.name} (sem qualificação de avaliador)`}
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

      {therapistId && hasAvailabilityConfigured && (
        <p className="text-[11px] text-ink-faint">
          Mostrando só a disponibilidade cadastrada de {availableTherapists.find((t) => t.id === therapistId)?.name ?? "—"} —{" "}
          <span style={{ color: "var(--color-success)" }} className="font-semibold">verde</span> é horário livre dele,{" "}
          <span style={{ color: "var(--color-error)" }} className="font-semibold">vermelho</span> é fora do expediente ou fechado.
        </p>
      )}

      {feedback && (
        <p className={`text-xs ${feedback.type === "success" ? "text-status-positive-text" : "text-status-negative-text"}`}>{feedback.text}</p>
      )}

      <div className="flex gap-4">
        {/* Fila lateral */}
        <aside className="w-64 shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Aguardando agendamento ({pool.length})</h3>
          <p className="mb-2 mt-0.5 text-[10px] text-ink-faint">Clique num paciente para ver os documentos e aprovar, rejeitar ou enviar mensagem sem sair da agenda.</p>
          <div className="flex flex-col gap-2">
            {readyPool.map((item) => (
              <div
                key={item.id}
                draggable={hasEvaluators}
                role="button"
                tabIndex={0}
                onDragStart={(e) => {
                  if (!hasEvaluators) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData("application/json", JSON.stringify({ kind: "pool", poolItemId: item.id } satisfies DragPayload));
                }}
                onClick={(e) => openQuickView(item, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openQuickView(item, e.currentTarget);
                  }
                }}
                className={`grid-cell-focusable rounded-md border border-paper-line-strong bg-white p-2.5 shadow-sm hover:border-[var(--color-accent)] ${
                  hasEvaluators ? "cursor-grab active:cursor-grabbing" : "cursor-pointer opacity-70"
                }`}
                title={
                  hasEvaluators
                    ? "Clique para consulta rápida (laudo, guia, contato) · arraste para uma célula do calendário para agendar"
                    : "Clique para consulta rápida — cadastre um terapeuta avaliador para liberar o agendamento"
                }
              >
                <p className="text-xs font-semibold text-ink">{item.patientName}</p>
                <span className={`tag-status mt-1 inline-block ${item.gate ? "st-agendada" : ORIGIN_TAG[item.origin]}`}>
                  {item.gate ? "Docs · Recepção" : ORIGIN_LABEL[item.origin]}
                </span>
                {item.gate === "habilitado" && (
                  <span
                    className="tag-status st-confirmada ml-1 mt-1 inline-block"
                    title="A Recepção conferiu os documentos, o plano autorizou e o agendamento foi habilitado"
                  >
                    ✓ OK da Recepção
                  </span>
                )}
                <p className="mt-1 text-[11px] text-ink-faint">{item.detail}</p>
              </div>
            ))}
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
                <span className={`tag-status mt-1 inline-block ${item.gate ? "st-agendada" : ORIGIN_TAG[item.origin]}`}>
                  {item.gate ? "Docs · Recepção" : ORIGIN_LABEL[item.origin]}
                </span>
                <div className="mt-1.5 flex items-center gap-1.5">
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
            {pool.length === 0 && <p className="text-xs text-ink-faint">Nenhum paciente aguardando 1ª avaliação.</p>}
          </div>
        </aside>

        {quickView && (
          <EvaluationQuickViewPanel
            key={quickView.item.id}
            item={quickView.item}
            anchorRect={quickView.rect}
            therapistId={therapistId}
            roomId={roomId}
            scheduleLabel={quickViewScheduleLabel}
            onClose={() => setQuickView(null)}
            onResolved={(text) => {
              setQuickView(null);
              setFeedback({ type: "success", text });
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
                        background: dragOverDay === dayIndex ? "var(--color-accent-100)" : "var(--status-confirmada-bg)",
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
                            draggable
                            tabIndex={0}
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "application/json",
                                JSON.stringify({ kind: "reschedule", appointmentId: a.id, durationMinutes } satisfies DragPayload),
                              );
                            }}
                            className="grid-cell-focusable absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded-md border p-1 text-[11px] shadow-sm active:cursor-grabbing"
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
