"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";
import { setTherapistContract } from "./actions";
import type { TherapistRow } from "./types";

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function fmtCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TherapistContractRow({ therapist }: { therapist: TherapistRow }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <tr>
      <td className="font-semibold text-sm align-top">{therapist.fullName}</td>
      <td className="align-top">
        {therapist.current ? (
          <>
            <div className="text-sm">{therapist.current.tier}</div>
            <div className="text-xs text-ink-faint">{fmtCurrency(therapist.current.hourlyRate)}/h · desde {fmtDate(therapist.current.validFrom)}</div>
          </>
        ) : (
          <span className="text-xs text-status-negative-text">Sem faixa cadastrada — não recebe repasse</span>
        )}
        {therapist.history.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-ink-faint">Histórico ({therapist.history.length})</summary>
            <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-ink-faint">
              {therapist.history.map((c) => (
                <li key={c.id}>
                  {c.tier} · {fmtCurrency(c.hourlyRate)}/h · {fmtDate(c.validFrom)} a {c.validTo ? fmtDate(c.validTo) : "—"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </td>
      <td className="align-top text-right">
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="text-xs text-chart">
            {therapist.current ? "Alterar faixa" : "Cadastrar faixa"}
          </button>
        ) : (
          <form
            className="flex flex-col items-end gap-2"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await setTherapistContract(therapist.id, formData);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
              });
            }}
          >
            <input type="text" name="tier" required placeholder="Tier (ex: Pleno)" className="input w-40" />
            <input type="number" name="hourly_rate" required min={0.01} step="0.01" placeholder="Valor-hora (R$)" className="input w-40" />
            <input type="date" name="valid_from" required defaultValue={today} className="input w-40" />
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn btn-primary">
                {isPending ? "Salvando…" : "Salvar"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                Cancelar
              </button>
            </div>
            {error && <p className="w-40 text-right text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
          </form>
        )}
      </td>
    </tr>
  );
}

export function ProfissionaisManager({ therapists }: { therapists: TherapistRow[] }) {
  return (
    <>
      <ConfigSidebar active="profissionais" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Profissionais"
          description="Valor-hora por terapeuta (therapist_contracts) — usado pelo fechamento mensal de repasse."
        />
        <div className="flex flex-col gap-4 p-6 sm:p-10 max-w-3xl">
          <table className="table">
            <thead>
              <tr>
                <th>Terapeuta</th>
                <th>Faixa vigente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {therapists.map((t) => (
                <TherapistContractRow key={t.id} therapist={t} />
              ))}
              {therapists.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-ink-faint">
                    Nenhum terapeuta ativo cadastrado nesta clínica.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
