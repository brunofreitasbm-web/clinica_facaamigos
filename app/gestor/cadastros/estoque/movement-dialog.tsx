"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight } from "lucide-react";
import { registerMovement } from "./actions";

type ItemOption = { id: string; name: string; quantity_available: number };

export function MovementDialog({ items }: { items: ItemOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await registerMovement(new FormData(e.currentTarget));

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
      <button type="button" className="btn btn-secondary flex items-center gap-2" onClick={() => setOpen(true)}>
        <ArrowDownRight size={16} /> Registrar Movimento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Registrar Entrada/Saída</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Item
                <select name="itemId" required className="input" defaultValue="">
                  <option value="" disabled>
                    Selecione um item
                  </option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (disponível: {i.quantity_available})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Tipo
                  <select name="type" required className="input" defaultValue="saida">
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Quantidade
                  <input type="number" name="quantity" min="1" step="1" required className="input" />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Motivo
                <input type="text" name="reason" required className="input" placeholder="Ex.: aplicação de protocolo, reposição de compra" />
              </label>

              {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Salvando…" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
