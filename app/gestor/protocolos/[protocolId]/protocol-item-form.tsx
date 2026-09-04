"use client";

import { useState, useTransition } from "react";
import { createProtocolItem } from "./actions";

export function ProtocolItemForm({ protocolId }: { protocolId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="card grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_2fr_auto] sm:items-end"
      id="protocol-item-form"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createProtocolItem(protocolId, formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          (document.getElementById("protocol-item-form") as HTMLFormElement)?.reset();
        });
      }}
    >
      <div className="field">
        <label htmlFor="domain">Domínio</label>
        <input id="domain" name="domain" required className="input" placeholder="ex.: Mando" />
      </div>
      <div className="field">
        <label htmlFor="level">Nível</label>
        <input id="level" name="level" className="input" placeholder="ex.: 1" />
      </div>
      <div className="field">
        <label htmlFor="item_code">Código</label>
        <input id="item_code" name="item_code" required className="input" placeholder="ex.: M1-01" />
      </div>
      <div className="field">
        <label htmlFor="description">Descrição</label>
        <input id="description" name="description" required className="input" placeholder="Descrição do marco/habilidade" />
      </div>
      <button type="submit" disabled={isPending} className="btn btn-primary">
        {isPending ? "Salvando…" : "Adicionar item"}
      </button>
      {error && <p className="text-xs text-status-negative-text sm:col-span-full">{error}</p>}
    </form>
  );
}
