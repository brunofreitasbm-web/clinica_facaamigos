"use client";

import { useState, useTransition } from "react";
import { createAppointmentType, updateAppointmentType } from "./actions";
import { MODALITY_LABEL, RECURRENCE_LABEL, type AppointmentType, type InsurerOption } from "./types";

export function AppointmentTypeDialog({
  appointmentType,
  insurers = [],
}: {
  appointmentType?: AppointmentType;
  insurers?: InsurerOption[];
}) {
  const isEdit = Boolean(appointmentType);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsurerId, setSelectedInsurerId] = useState<string>(appointmentType?.insurerId ?? "");
  const [isPending, startTransition] = useTransition();

  const selectedInsurer = insurers.find((i) => i.id === selectedInsurerId);

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      {isEdit ? (
        <button type="button" className="text-xs text-chart" onClick={() => setOpen(true)}>
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
          <div className="dialog" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
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
                <label htmlFor="name">Nome do Atendimento</label>
                <input id="name" name="name" required defaultValue={appointmentType?.name} className="input" placeholder="Ex.: Psicologia ABA ou Psicoterapia Convencional" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="insurer_id">Plano de Saúde (Convênio)</label>
                  <select
                    id="insurer_id"
                    name="insurer_id"
                    className="input"
                    value={selectedInsurerId}
                    onChange={(e) => setSelectedInsurerId(e.target.value)}
                  >
                    <option value="">Geral / Sem convênio específico</option>
                    {insurers.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="procedure_code">Código do Procedimento</label>
                  {selectedInsurer && selectedInsurer.procedures.length > 0 ? (
                    <select
                      id="procedure_code"
                      name="procedure_code"
                      className="input"
                      defaultValue={appointmentType?.procedureCode ?? ""}
                    >
                      <option value="">Selecione o procedimento...</option>
                      {selectedInsurer.procedures.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="procedure_code"
                      name="procedure_code"
                      className="input"
                      placeholder="Ex.: 40901234"
                      defaultValue={appointmentType?.procedureCode ?? ""}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                  <label htmlFor="recurrence">Recorrência / Exibição</label>
                  <select id="recurrence" name="recurrence" required defaultValue={appointmentType?.recurrence ?? "semanal"} className="input">
                    {Object.entries(RECURRENCE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <input type="hidden" name="display_interval_minutes" value={appointmentType?.displayIntervalMinutes ?? 30} />
                </div>
              </div>

              <div className="rounded-md border border-paper-line bg-paper/60 p-3 mt-1">
                <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    name="requires_intern_ratio"
                    defaultChecked={appointmentType?.requiresInternRatio ?? true}
                    className="mt-0.5 rounded border-paper-line"
                  />
                  <div>
                    <span className="font-semibold block">Aplicar regra de 1 estagiário por criança neste tipo de atendimento</span>
                    <span className="text-ink-faint block mt-0.5 leading-relaxed">
                      Desmarque para tipos 1:1 terapeuta-paciente (ex.: avaliação neuropsicológica, psicoterapia e fonoaudiologia convencionais).
                    </span>
                  </div>
                </label>
              </div>

              {error && (
                <p className="text-xs font-medium" style={{ color: "var(--status-falta)" }}>
                  {error}
                </p>
              )}

              <div className="dialog-actions mt-2">
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
