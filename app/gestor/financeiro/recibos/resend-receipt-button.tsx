"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { resendReceiptAction } from "./actions";

export function ResendReceiptButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await resendReceiptAction(receiptId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn btn-ghost text-xs flex items-center gap-1" onClick={handleClick} disabled={isPending}>
        <Send size={12} /> {isPending ? "Enviando…" : "Reenviar"}
      </button>
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
    </div>
  );
}
