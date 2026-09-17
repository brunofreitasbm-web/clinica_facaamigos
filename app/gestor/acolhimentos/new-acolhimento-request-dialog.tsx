"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestAcolhimento } from "./actions";

export function NewAcolhimentoRequestDialog({
  patients,
  insurers,
  specialties,
}: {
  patients: { id: string; full_name: string }[];
  insurers: { id: string; name: string }[];
  specialties: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [funding, setFunding] = useState<"particular" | "convenio">("particular");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setError(null);
    setFunding("particular");
    setOpen(true);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("funding", funding);
    startTransition(async () => {
      const res = await requestAcolhimento(formData);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="btn btn-primary text-xs" onClick={handleOpen}>
        Solicitar acolhimento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Solicitar vaga de acolhimento</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>

            <form action={handleSubmit} className="flex flex-col gap-4">
              {error && <p className="rounded-md bg-red-50 p-2 text-xs text-status-negative-text">{error}</p>}

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Paciente</label>
                <select name="patient_id" required className="input mt-1 w-full">
                  <option value="">Selecione o paciente</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Forma de pagamento</label>
                <div className="mt-1 flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="funding_radio"
                      checked={funding === "particular"}
                      onChange={() => setFunding("particular")}
                    />
                    Particular
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="funding_radio"
                      checked={funding === "convenio"}
                      onChange={() => setFunding("convenio")}
                    />
                    Convênio
                  </label>
                </div>
              </div>

              {funding === "convenio" && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Plano de saúde</label>
                  <select name="insurer_id" required className="input mt-1 w-full">
                    <option value="">Selecione o plano de saúde</option>
                    {insurers.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Especialidade</label>
                <select name="specialty_value" className="input mt-1 w-full">
                  <option value="">Não especificada</option>
                  {specialties.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Observações</label>
                <textarea name="notes" rows={2} className="input mt-1 w-full" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
                  {isPending ? "Enviando…" : "Enviar para a Recepção"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
