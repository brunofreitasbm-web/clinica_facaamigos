"use client";

import { useState, useTransition } from "react";
import { addPatientCharge, cancelCharge, markChargePaid } from "./actions";

export type ChargeRow = {
  id: string;
  description: string;
  amount: number;
  status: "pendente" | "pago" | "cancelado";
  dueDateLabel: string | null;
  createdAtLabel: string;
};

const STATUS_TAG: Record<ChargeRow["status"], string> = {
  pendente: "st-agendada",
  pago: "st-realizada",
  cancelado: "st-cancelada",
};

const fmtCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ChargesPanel({
  patientId,
  charges,
  open,
  onOpenChange,
}: {
  patientId: string;
  charges: ChargeRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
          Cobranças particulares
        </h6>
        {!open && (
          <button type="button" className="btn btn-primary text-xs" onClick={() => onOpenChange(true)}>
            Cobrar
          </button>
        )}
      </div>

      {open && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border border-paper-line-strong bg-paper px-4 py-3"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await addPatientCharge(patientId, formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              onOpenChange(false);
              (document.getElementById("charge-form") as HTMLFormElement)?.reset();
            });
          }}
          id="charge-form"
        >
          <div className="flex-1 basis-56">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Descrição</label>
            <input name="description" required placeholder="Ex.: sessão avulsa" className="input mt-1" />
          </div>
          <div className="w-32">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Valor (R$)</label>
            <input name="amount" required type="number" step="0.01" min="0.01" className="input mt-1" />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Vencimento</label>
            <input name="due_date" type="date" className="input mt-1" />
          </div>
          <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
            {isPending ? "Salvando…" : "Registrar cobrança"}
          </button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          {error && <p className="basis-full text-xs text-status-negative-text">{error}</p>}
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {charges.map((charge) => (
            <tr key={charge.id}>
              <td className="font-semibold">{charge.description}</td>
              <td className="tabular-figure">{fmtCurrency(charge.amount)}</td>
              <td>{charge.dueDateLabel ?? "—"}</td>
              <td>
                <span className={`tag-status ${STATUS_TAG[charge.status]}`}>{charge.status}</span>
              </td>
              <td className="text-right">
                {charge.status === "pendente" && (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => startTransition(() => { markChargePaid(patientId, charge.id); })}
                    >
                      Marcar como paga
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => startTransition(() => { cancelCharge(patientId, charge.id); })}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {charges.length === 0 && (
            <tr>
              <td colSpan={5} className="text-ink-faint">
                Nenhuma cobrança registrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
