"use client";

import { useState, useTransition } from "react";
import { upsertInsurerProcedureCode, deleteInsurerProcedureCode } from "./actions";

export type ProcedureCodeRow = {
  id: string | null;
  specialtyValue: string;
  specialtyLabel: string;
  procedureCode: string;
  procedureName: string;
  requiresPriorAuth: boolean;
  groupAllowed: boolean;
  maxGroupSize: number;
  sessionMinutes: number | null;
};

function ProcedureCodeRowView({ insurerId, row }: { insurerId: string; row: ProcedureCodeRow }) {
  const [editing, setEditing] = useState(!row.procedureCode);
  const [procedureCode, setProcedureCode] = useState(row.procedureCode);
  const [procedureName, setProcedureName] = useState(row.procedureName);
  const [requiresPriorAuth, setRequiresPriorAuth] = useState(row.requiresPriorAuth);
  const [groupAllowed, setGroupAllowed] = useState(row.groupAllowed);
  const [maxGroupSize, setMaxGroupSize] = useState(String(row.maxGroupSize));
  const [sessionMinutes, setSessionMinutes] = useState(row.sessionMinutes != null ? String(row.sessionMinutes) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("specialty_value", row.specialtyValue);
      fd.set("procedure_code", procedureCode);
      fd.set("procedure_name", procedureName);
      if (requiresPriorAuth) fd.set("requires_prior_auth", "on");
      if (groupAllowed) fd.set("group_allowed", "on");
      fd.set("max_group_size", maxGroupSize);
      fd.set("session_minutes", sessionMinutes);
      const result = await upsertInsurerProcedureCode(insurerId, fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  };

  const remove = () => {
    if (!row.id) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteInsurerProcedureCode(insurerId, row.id as string);
      if (!result.success) {
        setError(result.error);
      }
    });
  };

  if (!editing) {
    return (
      <tr>
        <td>{row.specialtyLabel}</td>
        <td className="tabular-nums">{row.procedureCode || "—"}</td>
        <td>{row.procedureName || "—"}</td>
        <td>{row.requiresPriorAuth ? "Sim" : "Não"}</td>
        <td>{row.groupAllowed ? `Sim (até ${row.maxGroupSize})` : "Não"}</td>
        <td className="tabular-nums">{row.sessionMinutes ?? "—"}</td>
        <td className="text-right">
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setEditing(true)}>
              Editar
            </button>
            {row.id && (
              <button type="button" className="btn btn-ghost text-xs" disabled={isPending} onClick={remove}>
                Excluir
              </button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{row.specialtyLabel}</td>
      <td>
        <input className="input w-28" value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} />
      </td>
      <td>
        <input className="input w-40" value={procedureName} onChange={(e) => setProcedureName(e.target.value)} />
      </td>
      <td>
        <input
          type="checkbox"
          checked={requiresPriorAuth}
          onChange={(e) => setRequiresPriorAuth(e.target.checked)}
        />
      </td>
      <td className="flex items-center gap-2">
        <input type="checkbox" checked={groupAllowed} onChange={(e) => setGroupAllowed(e.target.checked)} />
        {groupAllowed && (
          <input
            className="input w-16"
            type="number"
            min={1}
            value={maxGroupSize}
            onChange={(e) => setMaxGroupSize(e.target.value)}
          />
        )}
      </td>
      <td>
        <input
          className="input w-20"
          type="number"
          min={1}
          value={sessionMinutes}
          onChange={(e) => setSessionMinutes(e.target.value)}
        />
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" disabled={isPending} onClick={save}>
            {isPending ? "Salvando…" : "Salvar"}
          </button>
          {row.procedureCode && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
      </td>
    </tr>
  );
}

export function ProcedureCodesForm({ insurerId, rows }: { insurerId: string; rows: ProcedureCodeRow[] }) {
  return (
    <table className="table mb-6">
      <thead>
        <tr>
          <th>Especialidade</th>
          <th>Código</th>
          <th>Nome do procedimento</th>
          <th>Requer autorização prévia</th>
          <th>Permite grupo</th>
          <th>Duração (min)</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ProcedureCodeRowView key={row.specialtyValue} insurerId={insurerId} row={row} />
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="text-ink-faint">
              Nenhuma especialidade ativa cadastrada ainda.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
