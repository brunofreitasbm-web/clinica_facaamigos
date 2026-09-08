"use client";

import { useState, useTransition } from "react";
import { importProtocolItems } from "./actions";

export function ProtocolImportForm({ protocolId }: { protocolId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleImport() {
    setError(null);
    setSuccessCount(null);
    startTransition(async () => {
      const result = await importProtocolItems(protocolId, text);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccessCount(result.itemCount ?? 0);
      setText("");
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary w-fit text-xs" onClick={() => setOpen(true)}>
        Importar itens em massa
      </button>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="m-0 text-sm font-medium text-ink">Importar itens em massa</p>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(false)}>
          Fechar
        </button>
      </div>
      <p className="m-0 text-xs text-ink-faint">
        Uma linha por item, no formato <code>domínio;nível;código;descrição</code> (nível pode ficar vazio: <code>domínio;;código;descrição</code>).
        Aceita colar direto de planilha (separador tab).
      </p>
      <textarea
        className="input min-h-[160px] font-mono text-xs"
        placeholder={"Mando;Nível 1;N1-MAN-01;Pede um item preferido com uma palavra\nTato;Nível 1;N1-TAT-01;Nomeia um objeto comum ao ser mostrado"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary w-fit text-xs" disabled={isPending || !text.trim()} onClick={handleImport}>
          {isPending ? "Importando…" : "Importar"}
        </button>
        {error && <p className="m-0 text-xs text-status-negative-text">{error}</p>}
        {successCount !== null && (
          <p className="m-0 text-xs" style={{ color: "var(--status-realizada)" }}>
            {successCount} {successCount === 1 ? "item importado" : "itens importados"}.
          </p>
        )}
      </div>
    </div>
  );
}
