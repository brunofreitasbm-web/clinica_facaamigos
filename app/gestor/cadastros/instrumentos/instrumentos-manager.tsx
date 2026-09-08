"use client";

import { useState, useTransition } from "react";
import { CadastrosSidebar } from "../cadastros-sidebar";
import { setInstrumentEnabled, saveInstrumentLicense } from "./actions";

export type InstrumentRow = {
  key: string;
  shortLabel: string;
  label: string;
  description: string;
  disciplineLabel: string;
  enabled: boolean;
  licensePurchasedAt: string | null;
  licenseNote: string | null;
};

function InstrumentRowView({ instrument }: { instrument: InstrumentRow }) {
  const [editingLicense, setEditingLicense] = useState(false);
  const [purchasedAt, setPurchasedAt] = useState(instrument.licensePurchasedAt ?? "");
  const [note, setNote] = useState(instrument.licenseNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <tr>
        <td>
          <span className={instrument.enabled ? "" : "text-ink-faint line-through"}>{instrument.shortLabel}</span>
          <p className="m-0 text-xs text-ink-faint">{instrument.description}</p>
        </td>
        <td className="text-ink-faint">{instrument.disciplineLabel}</td>
        <td className="text-ink-faint">
          {instrument.licensePurchasedAt ? (
            <span className="text-xs">
              {new Date(`${instrument.licensePurchasedAt}T00:00:00`).toLocaleDateString("pt-BR")}
              {instrument.licenseNote ? ` · ${instrument.licenseNote}` : ""}
            </span>
          ) : (
            <span className="text-xs">Não informada</span>
          )}
        </td>
        <td className="text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => setEditingLicense((v) => !v)}
            >
              Licença
            </button>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await setInstrumentEnabled(instrument.key, !instrument.enabled);
                  if (!result.success) setError(result.error);
                })
              }
            >
              {instrument.enabled ? "Desativar" : "Reativar"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
        </td>
      </tr>
      {editingLicense && (
        <tr>
          <td colSpan={4}>
            <div className="flex flex-wrap items-end gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-ink-faint">Data de compra da licença</span>
                <input
                  type="date"
                  className="input"
                  value={purchasedAt}
                  onChange={(e) => setPurchasedAt(e.target.value)}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm" style={{ minWidth: 240 }}>
                <span className="text-xs text-ink-faint">Observação (nº de série, responsável, validade)</span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("license_purchased_at", purchasedAt);
                    fd.set("license_note", note);
                    const result = await saveInstrumentLicense(instrument.key, fd);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setEditingLicense(false);
                  })
                }
              >
                {isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function InstrumentosManager({ instruments }: { instruments: InstrumentRow[] }) {
  return (
    <div className="flex flex-1">
      <CadastrosSidebar active="instrumentos" />
      <div className="flex-1 p-8">
        <h1 className="mb-1">Instrumentos de Avaliação</h1>
        <p className="mb-6 max-w-[760px] text-sm text-ink-soft">
          Instrumentos que o sistema aplica por conta própria — com os itens, a escala e o cálculo já
          programados. Desativar um deles esconde o atalho no prontuário e bloqueia as telas de aplicação; as
          avaliações já registradas continuam guardadas e voltam a aparecer se ele for reativado. Esta lista não
          é editável aqui: cada instrumento novo entra junto com a sua implementação.
        </p>

        <table className="table mb-6">
          <thead>
            <tr>
              <th>Instrumento</th>
              <th>Disciplina</th>
              <th>Licença</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {instruments.map((instrument) => (
              <InstrumentRowView key={instrument.key} instrument={instrument} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
