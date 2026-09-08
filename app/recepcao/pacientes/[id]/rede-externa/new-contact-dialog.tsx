"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createExternalContact } from "./actions";

const KIND_LABEL: Record<string, string> = {
  escola: "Escola",
  medico: "Médico",
  outro_profissional: "Outro Profissional",
};

export function NewContactDialog({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createExternalContact(patientId, new FormData(e.currentTarget));
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
        <Plus size={16} /> Novo Contato
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Novo Contato Externo</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Tipo
                <select name="kind" required className="input" defaultValue="escola">
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Nome
                  <input type="text" name="name" required className="input" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Cargo/Especialidade
                  <input type="text" name="roleTitle" className="input" placeholder="Ex.: Professora regente, Neuropediatra" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Telefone
                  <input type="text" name="phone" className="input" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  E-mail
                  <input type="email" name="email" className="input" />
                </label>
              </div>
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
                  {loading ? "Salvando…" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
