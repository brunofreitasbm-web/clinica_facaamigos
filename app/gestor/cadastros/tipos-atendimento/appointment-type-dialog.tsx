"use client";

import { useState, useTransition } from "react";
import { createAppointmentType, updateAppointmentType } from "./actions";
import { MODALITY_LABEL, RECURRENCE_LABEL, type AppointmentType } from "./types";

export function AppointmentTypeDialog({ appointmentType }: { appointmentType?: AppointmentType }) {
  const isEdit = Boolean(appointmentType);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      {isEdit ? (
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>
          Editar
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden>
            <path d="M128 40v176M40 128h176" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
          </svg>
          Novo tipo de atendimento
        </button>
      )}

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">{isEdit ? "Editar tipo de atendimento" : "Novo tipo de atendimento"}</h2>

            <form
              className="flex flex-col gap-3"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = isEdit
                    ? await updateAppointmentType(appointmentType!.id, formData)
                    : await createAppointmentType(formData);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  close();
                });
              }}
            >
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input id="name" name="name" required defaultValue={appointmentType?.name} className="input" placeholder="Ex.: Psicologia ABA" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="modality">Modalidade</label>
                  <select id="modality" name="modality" required defaultValue={appointmentType?.modality ?? "presencial"} className="input">
                    {Object.entries(MODALITY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="recurrence">Recorrência</label>
                  <select id="recurrence" name="recurrence" required defaultValue={appointmentType?.recurrence ?? "semanal"} className="input">
                    {Object.entries(RECURRENCE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="duration_minutes">Duração (minutos)</label>
                  <input
                    id="duration_minutes"
                    name="duration_minutes"
                    type="number"
                    min={1}
                    required
                    defaultValue={appointmentType?.durationMinutes ?? 30}
                    className="input"
                  />
                </div>
                <div className="field">
                  <label htmlFor="display_interval_minutes">Exibição (a cada, minutos)</label>
                  <input
                    id="display_interval_minutes"
                    name="display_interval_minutes"
                    type="number"
                    min={1}
                    required
                    defaultValue={appointmentType?.displayIntervalMinutes ?? 30}
                    className="input"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs" style={{ color: "var(--status-falta)" }}>
                  {error}
                </p>
              )}

              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={close}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
