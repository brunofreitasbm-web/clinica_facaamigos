"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createContract } from "./actions";
import type { CatalogPlan } from "@/lib/particular-plans-pure";

type PatientOption = { id: string; full_name: string };

export function NewContractDialog({ patients, plans }: { patients: PatientOption[]; plans: CatalogPlan[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planType, setPlanType] = useState("particular");
  const [packageCode, setPackageCode] = useState("");
  // Particular puro: a mensalidade é o valor do pacote (global), não digitada.
  const isParticular = planType === "particular";
  const selectedPlan = plans.find((p) => p.code === packageCode);

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
                <select name="planType" required className="input" value={planType} onChange={(e) => setPlanType(e.target.value)}>
                  <option value="particular">Particular Puro</option>
                  <option value="reembolso_assistido">Reembolso Assistido</option>
                  <option value="coparticipacao">Co-participação</option>
                </select>
              </label>

              {isParticular && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Pacote
                  <select name="packageCode" required className="input" value={packageCode} onChange={(e) => setPackageCode(e.target.value)}>
                    <option value="" disabled>
                      Selecione o pacote
                    </option>
                    {plans.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} · {p.sessions} {p.sessions === 1 ? "sessão" : "sessões"}/mês ·{" "}
                        {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-normal text-ink-faint">
                    Valor global do pacote, igual para qualquer terapia. A avaliação inicial conta como 1 sessão e cada
                    bloco de Treino ABA conta como 3.
                  </span>
                </label>
              )}

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Mensalidade (R$)
                  {isParticular ? (
                    <input type="text" readOnly className="input" value={selectedPlan ? selectedPlan.price.toFixed(2).replace(".", ",") : ""} placeholder="Defina pelo pacote" />
                  ) : (
                    <input type="number" name="monthlyFee" step="0.01" min="0.01" required className="input" />
                  )}
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
