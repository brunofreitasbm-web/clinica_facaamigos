"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { logExternalContact } from "./actions";

const CHANNEL_LABEL: Record<string, string> = {
  telefone: "Telefone",
  email: "E-mail",
  reuniao: "Reunião",
  relatorio_compartilhado: "Relatório Compartilhado",
  outro: "Outro",
};

export function LogContactDialog({ patientId, externalContactId, contactName }: { patientId: string; externalContactId: string; contactName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await logExternalContact(patientId, new FormData(e.currentTarget));
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
      <button type="button" className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setOpen(true)}>
        <MessageCircle size={12} /> Registrar Contato
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Registrar Contato com {contactName}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input type="hidden" name="externalContactId" value={externalContactId} />
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Canal
                <select name="channel" required className="input" defaultValue="telefone">
                  {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                O que foi tratado
                <textarea name="summary" required rows={3} className="input" />
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
