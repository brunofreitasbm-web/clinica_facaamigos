"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createContract } from "./actions";
import { computeMonthlyFee } from "@/lib/contract-billing";

type PatientOption = { id: string; full_name: string };
type SpecialtyOption = { value: string; label: string; price: number | null };

export function NewContractDialog({
  patients,
  specialties,
  defaultSessionsPerMonth,
}: {
  patients: PatientOption[];
  specialties: SpecialtyOption[];
  defaultSessionsPerMonth: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [billingMode, setBillingMode] = useState<"pacote" | "avulsa">("pacote");
  const [specialtyValue, setSpecialtyValue] = useState(specialties[0]?.value ?? "");
  const [unitPrice, setUnitPrice] = useState<number>(specialties[0]?.price ?? 0);
  const [sessionsPerMonth, setSessionsPerMonth] = useState<number>(defaultSessionsPerMonth);

  const monthlyFee = useMemo(() => computeMonthlyFee(unitPrice || 0, sessionsPerMonth || 0), [unitPrice, sessionsPerMonth]);

  function handleSpecialtyChange(value: string) {
    setSpecialtyValue(value);
    const found = specialties.find((s) => s.value === value);
    if (found?.price != null) setUnitPrice(found.price);
  }

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
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto"
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

              <fieldset className="flex flex-col gap-2 rounded-md border border-paper-line-strong p-3">
                <legend className="px-1 text-xs font-semibold text-ink-faint">Forma de cobrança</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="billingMode"
                    value="pacote"
                    checked={billingMode === "pacote"}
                    onChange={() => setBillingMode("pacote")}
                  />
                  Pacote mensal adiantado (recomendado)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="billingMode"
                    value="avulsa"
                    checked={billingMode === "avulsa"}
                    onChange={() => setBillingMode("avulsa")}
                  />
                  Avulsa (cobrada por sessão realizada)
                </label>
              </fieldset>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Especialidade
                <select
                  name="specialtyValue"
                  required
                  className="input"
                  value={specialtyValue}
                  onChange={(e) => handleSpecialtyChange(e.target.value)}
                >
                  <option value="" disabled>
                    Selecione a especialidade
                  </option>
                  {specialties.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Valor unitário (R$)
                  <input
                    type="number"
                    name="unitPrice"
                    step="0.01"
                    min="0.01"
                    required
                    className="input"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                  />
                </label>
                {billingMode === "pacote" ? (
                  <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                    Sessões por mês
                    <input
                      type="number"
                      name="sessionsPerMonth"
                      min="1"
                      max="60"
                      required
                      className="input"
                      value={sessionsPerMonth}
                      onChange={(e) => setSessionsPerMonth(Number(e.target.value))}
                    />
                  </label>
                ) : (
                  <div className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                    Sessões por mês
                    <span className="input flex items-center text-ink-faint">— (cobrada por sessão)</span>
                  </div>
                )}
              </div>

              {billingMode === "pacote" && (
                <div className="rounded-md bg-paper px-3 py-2 text-sm">
                  Mensalidade do pacote:{" "}
                  <strong className="tabular-figure">
                    {monthlyFee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </strong>
                  <input type="hidden" name="monthlyFeePreview" value={monthlyFee} readOnly />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Dia de vencimento
                  <input type="number" name="paymentDay" min="1" max="31" required className="input" defaultValue={5} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Dia de faturamento
                  <input type="number" name="invoiceDay" min="1" max="28" required className="input" defaultValue={1} />
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
