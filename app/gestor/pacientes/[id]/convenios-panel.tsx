"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { addPatientInsurance, deletePatientInsurance, updatePatientInsurance } from "./actions";

export type ConvenioRow = {
  id: string;
  insurerId: string;
  insurerName: string;
  planName: string | null;
  cardNumber: string | null;
};

export type InsurerOption = { id: string; name: string };

function ConvenioForm({
  insurers,
  defaultValues,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  insurers: InsurerOption[];
  defaultValues?: { insurerId: string; planName: string | null; cardNumber: string | null };
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<{ success: true } | { success: false; error: string }>;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-paper-line-strong bg-paper px-4 py-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await onSubmit(formData);
          if (!result.success) setError(result.error);
        });
      }}
    >
      <select name="insurer_id" required defaultValue={defaultValues?.insurerId ?? ""} className="input">
        <option value="">Convênio</option>
        {insurers.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <input
        name="plan_name"
        placeholder="Plano (ex.: cooperativa de trabalho médico)"
        defaultValue={defaultValues?.planName ?? ""}
        className="input"
      />
      <input
        name="card_number"
        placeholder="Número da carteirinha"
        defaultValue={defaultValues?.cardNumber ?? ""}
        className="input"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
          {isPending ? "Salvando…" : submitLabel}
        </button>
        <button type="button" className="btn btn-ghost text-xs" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}

function ConvenioCard({
  patientId,
  convenio,
  insurers,
}: {
  patientId: string;
  convenio: ConvenioRow;
  insurers: InsurerOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <ConvenioForm
        insurers={insurers}
        defaultValues={{ insurerId: convenio.insurerId, planName: convenio.planName, cardNumber: convenio.cardNumber }}
        submitLabel="Salvar"
        onCancel={() => setEditing(false)}
        onSubmit={async (formData) => {
          const result = await updatePatientInsurance(patientId, convenio.id, formData);
          if (result.success) setEditing(false);
          return result;
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-paper-line-strong bg-paper px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
          {convenio.insurerName}
        </h6>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Editar convênio"
            className="btn btn-secondary btn-icon"
            onClick={() => setEditing(true)}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label="Remover convênio"
            disabled={isPending}
            className="btn btn-secondary btn-icon"
            onClick={() => {
              if (confirm(`Remover o convênio ${convenio.insurerName} deste paciente?`)) {
                startTransition(() => { deletePatientInsurance(patientId, convenio.id); });
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {convenio.planName && (
        <div className="text-sm">
          <span className="font-semibold">Plano</span>{" "}
          <span className="text-ink-soft">{convenio.planName}</span>
        </div>
      )}
      {convenio.cardNumber && (
        <div className="text-sm">
          <span className="font-semibold">Número da Carteirinha</span>{" "}
          <span className="text-ink-soft">{convenio.cardNumber}</span>
        </div>
      )}
    </div>
  );
}

export function ConveniosPanel({
  patientId,
  convenios,
  insurers,
}: {
  patientId: string;
  convenios: ConvenioRow[];
  insurers: InsurerOption[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="card max-w-[520px]">
      <div className="flex items-center justify-between">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
          Convênios
        </h6>
        {!adding && (
          <button type="button" className="btn btn-secondary text-xs" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Adicionar Convênio
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {adding && (
          <ConvenioForm
            insurers={insurers}
            submitLabel="Adicionar"
            onCancel={() => setAdding(false)}
            onSubmit={async (formData) => {
              const result = await addPatientInsurance(patientId, formData);
              if (result.success) setAdding(false);
              return result;
            }}
          />
        )}

        {convenios.map((c) => (
          <ConvenioCard key={c.id} patientId={patientId} convenio={c} insurers={insurers} />
        ))}

        {convenios.length === 0 && !adding && (
          <p className="text-sm text-ink-faint">Nenhum convênio cadastrado — paciente particular.</p>
        )}
      </div>
    </div>
  );
}
