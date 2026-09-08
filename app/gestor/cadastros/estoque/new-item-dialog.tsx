"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createInventoryItem } from "./actions";

const CATEGORY_LABEL: Record<string, string> = {
  teste_psicologico: "Teste Psicológico",
  brinquedo_pedagogico: "Brinquedo Pedagógico",
  material_consumo: "Material de Consumo",
  equipamento: "Equipamento",
  outros: "Outros",
};

export function NewItemDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createInventoryItem(new FormData(e.currentTarget));

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
        <Plus size={16} /> Cadastrar Novo Item
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Cadastrar Novo Item</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Nome do item
                <input type="text" name="name" required className="input" />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Categoria
                <select name="category" required className="input" defaultValue="material_consumo">
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Qtd. disponível
                  <input type="number" name="quantityAvailable" min="0" step="1" required className="input" defaultValue={0} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Qtd. mínima
                  <input type="number" name="minQuantity" min="0" step="1" required className="input" defaultValue={5} />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Custo unitário (R$)
                <input type="number" name="unitCost" min="0" step="0.01" className="input" defaultValue={0} />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Localização
                <input type="text" name="location" className="input" placeholder="Ex.: Armário A - Prateleira 2" />
              </label>

              {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Salvando…" : "Cadastrar Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
