"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markExpensePaid, cancelExpense } from "./actions";

export function ExpenseRowActions({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleMarkPaid() {
    setError(null);
    startTransition(async () => {
      const res = await markExpensePaid(expenseId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelExpense(expenseId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={handleMarkPaid} disabled={isPending}>
          Marcar como Paga
        </button>
        <button type="button" className="btn btn-ghost text-xs" onClick={handleCancel} disabled={isPending}>
          Cancelar
        </button>
      </div>
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
    </div>
  );
}
