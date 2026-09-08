"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText } from "lucide-react";
import { generateMonthlyInvoice, markInvoicePaid } from "./actions";

export function GenerateInvoiceButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await generateMonthlyInvoice(contractId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="btn btn-ghost text-xs flex items-center gap-1" onClick={handleClick} disabled={isPending}>
        <Send size={12} /> {isPending ? "Gerando…" : "Gerar Fatura do Mês"}
      </button>
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
    </div>
  );
}

export function MarkInvoicePaidButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await markInvoicePaid(invoiceId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="btn btn-ghost text-xs flex items-center gap-1" onClick={handleClick} disabled={isPending}>
        <FileText size={12} /> {isPending ? "Salvando…" : "Marcar como Paga"}
      </button>
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
    </div>
  );
}
