"use client";

import { useState, useTransition } from "react";
import { createServicePrice, updateServicePrice } from "./actions";
import type { InsurerOption, ServicePriceRow } from "./types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ServicePriceDialog({
  insurers,
  servicePrice,
  prefill,
  trigger,
}: {
  insurers: InsurerOption[];
  servicePrice?: ServicePriceRow;
  prefill?: { procedureCode: string; procedureName: string };
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(servicePrice);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : isEdit ? (
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>
          Editar
        </button>
      ) : (
        <button type="button" className="btn btn-gold" onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden>
            <path d="M128 40v176M40 128h176" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
          </svg>
          Novo Serviço
        </button>
      )}

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">{isEdit ? "Editar serviço" : "Novo serviço"}</h2>

            <form
              className="flex flex-col gap-3"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = isEdit
                    ? await updateServicePrice(servicePrice!.id, formData)
                    : await createServicePrice(formData);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  close();
                });
              }}
            >
              <div className="field">
                <label htmlFor="procedure_name">Nome do serviço</label>
                <input
                  id="procedure_name"
                  name="procedure_name"
                  required
                  defaultValue={servicePrice?.procedureName ?? prefill?.procedureName}
                  className="input"
                  placeholder="Ex.: Avaliação de Fonoaudiologia"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="procedure_code">Código do procedimento</label>
                  <input
                    id="procedure_code"
                    name="procedure_code"
                    required
                    defaultValue={servicePrice?.procedureCode ?? prefill?.procedureCode}
                    className="input"
                  />
                </div>
                <div className="field">
                  <label htmlFor="insurer_id">Convênio</label>
                  <select id="insurer_id" name="insurer_id" required defaultValue={servicePrice?.insurerId ?? ""} className="input">
                    <option value="" disabled>
                      Selecione
                    </option>
                    {insurers.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="cost">Custo (R$)</label>
                  <input id="cost" name="cost" type="number" step="0.01" min={0} defaultValue={servicePrice?.cost ?? ""} className="input" placeholder="Opcional" />
                </div>
                <div className="field">
                  <label htmlFor="price">Preço (R$)</label>
                  <input id="price" name="price" type="number" step="0.01" min={0.01} required defaultValue={servicePrice?.price} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="valid_from">Vigência (início)</label>
                  <input
                    id="valid_from"
                    name="valid_from"
                    type="date"
                    required
                    defaultValue={servicePrice?.validFrom ?? todayISO()}
                    className="input"
                  />
                </div>
                <div className="field">
                  <label htmlFor="valid_to">Vigência (fim)</label>
                  <input id="valid_to" name="valid_to" type="date" defaultValue={servicePrice?.validTo ?? ""} className="input" placeholder="Sem prazo" />
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
