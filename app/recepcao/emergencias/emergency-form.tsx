"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { Loader2, Calendar, Clock, AlertTriangle } from "lucide-react";
import {
  loadAffectedAppointments,
  dispatchEmergencyCalls,
  buildEmergencyMessage,
  type AffectedAppointment,
  type EmergencyShift,
} from "./actions";
import { StatusMonitorTable } from "./status-monitor-table";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";

function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EmergencyForm({ therapists }: { therapists: { id: string; name: string }[] }) {
  const [therapistId, setTherapistId] = useState("");
  // P1: Default to today's date
  const [date, setDate] = useState(getTodayString());
  const [shift, setShift] = useState<EmergencyShift>("manha");

  const [appointments, setAppointments] = useState<AffectedAppointment[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [dispatchSummary, setDispatchSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastWarning, setToastWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const therapistName = useMemo(
    () => therapists.find((t) => t.id === therapistId)?.name ?? "",
    [therapists, therapistId],
  );

  // P0 Form validation
  const isValid = Boolean(therapistId && date && shift);

  // P1 Auto-select shift when therapist is selected if applicable
  function handleTherapistChange(id: string) {
    setTherapistId(id);
    // Auto-select morning shift by default when therapist is picked
    if (id && !shift) {
      setShift("manha");
    }
  }

  function handleSearch() {
    setError(null);
    setToastWarning(null);
    if (!isValid) return;

    // P0 AbortController & 15s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setToastWarning("A busca está demorando mais que o normal. Tente recarregar a página.");
    }, 15000);

    startTransition(async () => {
      try {
        const rows = await loadAffectedAppointments(therapistId, date, shift);
        clearTimeout(timeoutId);
        setAppointments(rows);
        setSelectedIds(new Set(rows.map((r) => r.appointmentId)));
        setBroadcastId(null);
        setDispatchSummary(null);
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          setToastWarning("A busca foi abortada devido ao tempo limite. Tente novamente.");
        } else {
          setError("Erro ao buscar sessões. Tente novamente.");
        }
      }
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirmDispatch() {
    setError(null);
    startTransition(async () => {
      const result = await dispatchEmergencyCalls({
        therapistId,
        occurrenceDate: date,
        shift,
        appointmentIds: Array.from(selectedIds),
      });
      setShowConfirm(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBroadcastId(result.broadcastId);
      setDispatchSummary(
        `${result.dispatched} chamada(s) disparada(s)${result.skipped > 0 ? ` · ${result.skipped} paciente(s) sem telefone válido, não notificados` : ""}.`,
      );
    });
  }

  const todayStr = getTodayString();
  const tomorrowStr = getTomorrowString();

  return (
    <div className="flex flex-col gap-8">
      {/* Toast Warning para Timeout (P0) */}
      {toastWarning && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-800 shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span>{toastWarning}</span>
          <button
            type="button"
            className="ml-auto text-xs font-semibold underline text-amber-900 hover:text-amber-950"
            onClick={() => setToastWarning(null)}
          >
            Fechar
          </button>
        </div>
      )}

      <section className="rounded-lg border border-paper-line bg-paper/60 p-5 shadow-xs">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3 font-semibold">
          1. Terapeuta e período
        </h6>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Terapeuta *</label>
            <select
              value={therapistId}
              onChange={(e) => handleTherapistChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione…</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Data *</label>
              {/* P1 Chips de atalho rápido */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDate(todayStr)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    date === todayStr
                      ? "bg-accent text-white"
                      : "bg-paper-line text-ink-soft hover:bg-paper-line-strong hover:text-ink"
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setDate(tomorrowStr)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    date === tomorrowStr
                      ? "bg-accent text-white"
                      : "bg-paper-line text-ink-soft hover:bg-paper-line-strong hover:text-ink"
                  }`}
                >
                  Amanhã
                </button>
              </div>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="min-w-[140px]">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Turno *</label>
            <select value={shift} onChange={(e) => setShift(e.target.value as EmergencyShift)} className={inputClass}>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>

          {/* P0 Botão com validação e loading state */}
          <button
            type="button"
            disabled={!isValid || isPending}
            className={`btn flex items-center justify-center gap-2 font-semibold transition-all ${
              !isValid
                ? "bg-neutral-200 text-neutral-400 cursor-not-allowed border-transparent"
                : "btn-primary"
            }`}
            onClick={handleSearch}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
            {isPending ? "Buscando sessões..." : "Buscar sessões afetadas"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {appointments && (
        <section className="rounded-lg border border-paper-line bg-paper/60 p-5">
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            2. Pacientes afetados · {therapistName}
          </h6>
          {appointments.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhuma sessão encontrada para esse terapeuta/data/turno.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {appointments.map((appt) => (
                <label
                  key={appt.appointmentId}
                  className="flex items-start gap-3 rounded-md border border-paper-line bg-paper p-3 hover:border-paper-line-strong transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent"
                    checked={selectedIds.has(appt.appointmentId)}
                    onChange={() => toggleSelected(appt.appointmentId)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink">{appt.patientName}</span>
                      <span className="tabular-figure text-ink-soft">{appt.timeLabel}</span>
                    </div>
                    {appt.guardianPhone ? (
                      <p className="mt-1 text-xs text-ink-soft">
                        {buildEmergencyMessage(appt.patientName, appt.timeLabel)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        Sem telefone de responsável cadastrado — não será notificado.
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {appointments && appointments.length > 0 && (
        <section>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            3. Disparo
          </h6>
          <button
            type="button"
            disabled={isPending || selectedIds.size === 0}
            className="btn btn-primary"
            onClick={() => setShowConfirm(true)}
          >
            {isPending ? "Processando..." : "Enviar Avisos em Massa aos Responsáveis"}
          </button>
        </section>
      )}

      {dispatchSummary && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {dispatchSummary}
        </div>
      )}

      {broadcastId && (
        <section>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
            Acompanhamento em tempo real dos envios
          </h6>
          <StatusMonitorTable broadcastId={broadcastId} />
        </section>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="m-0 text-lg font-semibold text-ink">Confirmar envio de aviso em massa</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Serão disparados {selectedIds.size} aviso(s) para os responsáveis dos pacientes de{" "}
              <strong>{therapistName}</strong>, informando a falta do profissional e a necessidade de reagendamento.
              Deseja continuar?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowConfirm(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                className="btn btn-primary text-xs flex items-center gap-1.5"
                onClick={handleConfirmDispatch}
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isPending ? "Disparando…" : "Confirmar disparo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

