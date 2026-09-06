"use client";

import { useMemo, useState, useTransition } from "react";
import {
  loadAffectedAppointments,
  dispatchEmergencyCalls,
  buildEmergencyMessage,
  type AffectedAppointment,
  type EmergencyShift,
} from "./actions";
import { StatusMonitorTable } from "./status-monitor-table";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function EmergencyForm({ therapists }: { therapists: { id: string; name: string }[] }) {
  const [therapistId, setTherapistId] = useState("");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<EmergencyShift>("manha");

  const [appointments, setAppointments] = useState<AffectedAppointment[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [dispatchSummary, setDispatchSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const therapistName = useMemo(
    () => therapists.find((t) => t.id === therapistId)?.name ?? "",
    [therapists, therapistId],
  );

  function handleSearch() {
    setError(null);
    if (!therapistId || !date) {
      setError("Selecione o terapeuta e a data.");
      return;
    }
    startTransition(async () => {
      const rows = await loadAffectedAppointments(therapistId, date, shift);
      setAppointments(rows);
      setSelectedIds(new Set(rows.map((r) => r.appointmentId)));
      setBroadcastId(null);
      setDispatchSummary(null);
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

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-paper-line bg-paper/60 p-5">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
          1. Terapeuta e período
        </h6>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Terapeuta</label>
            <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className={inputClass}>
              <option value="">Selecione…</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Turno</label>
            <select value={shift} onChange={(e) => setShift(e.target.value as EmergencyShift)} className={inputClass}>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>
          <button type="button" disabled={isPending} className="btn btn-primary" onClick={handleSearch}>
            {isPending ? "Buscando…" : "Buscar sessões afetadas"}
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
                  className="flex items-start gap-3 rounded-md border border-paper-line bg-paper p-3"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
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
            Disparar Chamadas de Emergência por Voz
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
            Acompanhamento em tempo real
          </h6>
          <StatusMonitorTable broadcastId={broadcastId} />
        </section>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="m-0 text-lg font-semibold text-ink">Confirmar disparo de emergência</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Serão disparadas {selectedIds.size} chamada(s) de voz para responsáveis de pacientes de{" "}
              <strong>{therapistName}</strong>, informando que as sessões precisarão ser reagendadas. Deseja
              continuar?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowConfirm(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                className="btn btn-primary text-xs"
                onClick={handleConfirmDispatch}
              >
                {isPending ? "Disparando…" : "Confirmar disparo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
