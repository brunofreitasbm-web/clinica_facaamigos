"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createIncident } from "./actions";

type PatientOption = { id: string; full_name: string };

const KIND_LABEL: Record<string, string> = {
  reclamacao: "Reclamação",
  evento_adverso: "Evento Adverso",
  nao_conformidade: "Não Conformidade",
};

export function NewIncidentDialog({ patients }: { patients: PatientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createIncident(new FormData(e.currentTarget));
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
        <Plus size={16} /> Novo Registro
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4">Novo Registro de Ouvidoria</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Tipo
                  <select name="kind" required className="input" defaultValue="reclamacao">
                    {Object.entries(KIND_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Gravidade
                  <select name="severity" className="input" defaultValue="baixa">
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Paciente envolvido (opcional)
                <select name="patientId" className="input" defaultValue="">
                  <option value="">Não se aplica / não identificado</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Data/hora do ocorrido
                <input type="datetime-local" name="occurredAt" className="input" defaultValue={new Date().toISOString().slice(0, 16)} />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                Descrição
                <textarea name="description" required rows={4} className="input" placeholder="O que aconteceu, quem estava envolvido, contexto…" />
              </label>

              {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Registrando…" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
