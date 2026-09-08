"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIncidentStatus } from "./actions";

const STATUS_OPTIONS = [
  { value: "aberto", label: "Aberto" },
  { value: "em_analise", label: "Em Análise" },
  { value: "plano_de_acao", label: "Plano de Ação" },
  { value: "resolvido", label: "Resolvido" },
  { value: "arquivado", label: "Arquivado" },
] as const;

export function IncidentStatusForm({ incidentId, status, actionPlan }: { incidentId: string; status: string; actionPlan: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newStatus = String(formData.get("status") ?? status) as any;
    const plan = String(formData.get("actionPlan") ?? "");

    setError(null);
    startTransition(async () => {
      const res = await updateIncidentStatus(incidentId, newStatus, plan);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>
        Atualizar
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--color-neutral-200)" }}>
      <select name="status" defaultValue={status} className="input text-xs">
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <textarea name="actionPlan" defaultValue={actionPlan ?? ""} rows={2} className="input text-xs" placeholder="Plano de ação…" />
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary text-xs" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className="btn btn-secondary text-xs" onClick={() => setOpen(false)} disabled={isPending}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
