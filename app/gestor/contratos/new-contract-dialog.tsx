"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createContract } from "./actions";

type PatientOption = { id: string; full_name: string };

export function NewContractDialog({ patients }: { patients: PatientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await createContract(formData);

    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
        <Plus size={16} /> Novo Contrato de Paciente
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4">Novo Contrato de Paciente</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Paciente
                <select name="patientId" required className="input" defaultValue="">
                  <option value="" disabled>
                    Selecione um paciente
                  </option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Modalidade
                <select name="planType" required className="input" defaultValue="particular">
                  <option value="particular">Particular Puro</option>
                  <option value="reembolso_assistido">Reembolso Assistido</option>
                  <option value="coparticipacao">Co-participação</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Mensalidade (R$)
                  <input type="number" name="monthlyFee" step="0.01" min="0.01" required className="input" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Dia de vencimento
                  <input type="number" name="paymentDay" min="1" max="31" required className="input" defaultValue={5} />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Início do contrato
                <input type="date" name="startDate" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Observações
                <textarea name="notes" rows={2} className="input" />
              </label>

              {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Salvando…" : "Criar Contrato"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
