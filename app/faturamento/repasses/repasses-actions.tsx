"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closePayouts, markPayoutPaid } from "@/app/gestor/financeiro/actions";

export function CloseCompetenceButton({ competenceMonth }: { competenceMonth: string }) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose() {
    setMessage(null);
    startTransition(async () => {
      const result = await closePayouts(competenceMonth);
      if (!result.success) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      const skippedNote = result.skipped.length > 0 ? ` · não incluídos: ${result.skipped.join(", ")}` : "";
      setMessage({ kind: "success", text: `${result.closedCount} repasse(s) fechado(s)${skippedNote}.` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClose}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-status-positive px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-status-positive-text transition-colors disabled:opacity-50"
      >
        {isPending ? "Fechando…" : "Fechar repasses do mês"}
      </button>
      {message && (
        <p className={`text-xs ${message.kind === "error" ? "text-status-falta" : "text-status-positive-text"}`}>{message.text}</p>
      )}
    </div>
  );
}

export function MarkPaidButton({ payoutId }: { payoutId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markPayoutPaid(payoutId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleMarkPaid}
        disabled={isPending}
        className="rounded-full border border-paper-line-strong px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink hover:bg-paper-subtle disabled:opacity-50"
      >
        {isPending ? "Marcando…" : "Marcar pago"}
      </button>
      {error && <span className="text-[10px] text-status-falta">{error}</span>}
    </span>
  );
}
