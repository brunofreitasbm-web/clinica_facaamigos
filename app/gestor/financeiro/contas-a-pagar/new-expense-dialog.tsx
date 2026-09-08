"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createExpense } from "./actions";

const CATEGORY_LABEL: Record<string, string> = {
  aluguel: "Aluguel",
  folha: "Folha de Pagamento",
  fornecedores: "Fornecedores",
  impostos: "Impostos",
  marketing: "Marketing",
  manutencao: "Manutenção",
  outros: "Outros",
};

export function NewExpenseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createExpense(new FormData(e.currentTarget));

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
        <Plus size={16} /> Nova Despesa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Nova Despesa</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Categoria
                <select name="category" required className="input" defaultValue="outros">
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Descrição
                <input type="text" name="description" required className="input" placeholder="Ex.: Aluguel sala Unidade A — setembro" />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Valor (R$)
                  <input type="number" name="amount" step="0.01" min="0.01" required className="input" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Vencimento
                  <input type="date" name="dueDate" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-ink-faint">
                <input type="checkbox" name="recurring" />
                Despesa recorrente (repete todo mês)
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
                  {loading ? "Salvando…" : "Cadastrar Despesa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
