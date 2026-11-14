"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPayoutPaid } from "./actions";
import { ClosePayoutsConfirm } from "@/components/close-payouts-confirm";

export function CloseCompetenceButton({ competenceMonth }: { competenceMonth: string }) {
  return (
    <ClosePayoutsConfirm
      competenceMonth={competenceMonth}
      buttonClassName="inline-flex items-center gap-2 rounded-md bg-status-positive px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-status-positive-text transition-colors"
    />
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
