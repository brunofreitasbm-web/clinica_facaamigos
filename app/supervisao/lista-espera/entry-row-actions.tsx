"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { offerSlot, markScheduled, markWithdrawn } from "./actions";

export function EntryRowActions({ entryId, status }: { entryId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        setError(res.error ?? "Ação falhou.");
        return;
      }
      router.refresh();
    });
  }

  if (status === "aguardando") {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => run(() => offerSlot(entryId, true))} disabled={isPending}>
            Oferecer Vaga (WhatsApp)
          </button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => run(() => markWithdrawn(entryId))} disabled={isPending}>
            Desistiu
          </button>
        </div>
        {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
      </div>
    );
  }

  if (status === "oferecido") {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => run(() => markScheduled(entryId))} disabled={isPending}>
            Marcar Agendado
          </button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => run(() => markWithdrawn(entryId))} disabled={isPending}>
            Desistiu
          </button>
        </div>
        {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
      </div>
    );
  }

  return <span className="text-xs text-ink-faint">—</span>;
}
