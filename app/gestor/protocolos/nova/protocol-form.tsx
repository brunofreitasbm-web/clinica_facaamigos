"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PROTOCOL_CATALOG, PROTOCOL_AREAS } from "@/lib/protocol-catalog";
import { createProtocol } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function ProtocolForm() {
  const router = useRouter();
  const [selectedName, setSelectedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const entry = PROTOCOL_CATALOG.find((p) => p.name === selectedName);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProtocol(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/gestor/cadastros");
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Protocolo</label>
        <select name="name" required value={selectedName} onChange={(e) => setSelectedName(e.target.value)} className={inputClass}>
          <option value="">Selecione…</option>
          {PROTOCOL_CATALOG.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name="display_name" value={entry?.displayName ?? ""} />
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Área de avaliação</label>
        <select name="area" defaultValue={entry?.area ?? ""} className={inputClass} key={entry?.area ?? "none"}>
          <option value="">—</option>
          {PROTOCOL_AREAS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Versão (opcional)</label>
        <input name="version" className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Licença comprada em (opcional)</label>
        <input type="date" name="license_purchased_at" className={inputClass} />
      </div>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="risk_accepted" className="mt-1" />
        <span>
          Confirmo que a clínica possui licença de uso deste protocolo e assumo o risco de digitização das aplicações
          (PRD §9.4-A).
        </span>
      </label>
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary self-start">
          {isPending ? "Salvando…" : "Cadastrar protocolo"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </div>
    </form>
  );
}
