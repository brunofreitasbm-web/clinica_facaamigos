"use client";

import { useState, useTransition } from "react";
import { updatePatientBasics } from "./actions";

export function EditBasicsForm({
  patientId,
  fullName,
  birthDate,
  phone,
  guardianId,
  complaint,
  cid,
  supportLevel,
  entrySource,
  onDone,
}: {
  patientId: string;
  fullName: string;
  birthDate: string;
  phone: string | null;
  guardianId: string | null;
  complaint: string | null;
  cid: string | null;
  supportLevel: string | null;
  entrySource: string | null;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-paper-line-strong bg-paper px-4 py-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await updatePatientBasics(patientId, formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          onDone();
        });
      }}
    >
      <div className="flex-1 basis-56">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Nome</label>
        <input name="full_name" required defaultValue={fullName} className="input mt-1" />
      </div>
      <div className="w-40">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Nascimento</label>
        <input name="birth_date" type="date" required defaultValue={birthDate} className="input mt-1" />
      </div>
      <div className="w-44">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Telefone</label>
        <input name="phone" defaultValue={phone ?? ""} disabled={!guardianId} className="input mt-1" />
        <input type="hidden" name="guardian_id" value={guardianId ?? ""} />
      </div>
      <div className="w-44">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Origem</label>
        <input name="entry_source" defaultValue={entrySource ?? ""} placeholder="WhatsApp, indicação…" className="input mt-1" />
      </div>
      <div className="flex-1 basis-56">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Queixa principal</label>
        <input name="complaint" defaultValue={complaint ?? ""} className="input mt-1" />
      </div>
      <div className="w-32">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">CID</label>
        <input name="cid" defaultValue={cid ?? ""} className="input mt-1" />
      </div>
      <div className="w-40">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Nível de suporte</label>
        <input name="support_level" defaultValue={supportLevel ?? ""} placeholder="1, 2 ou 3" className="input mt-1" />
      </div>
      <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
        {isPending ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" className="btn btn-ghost text-xs" onClick={onDone}>
        Cancelar
      </button>
      {error && <p className="basis-full text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
