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

const PAID_METHOD_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

/**
 * Confirmar pagamento de uma fatura de contrato. Abre um mini-formulário
 * inline (forma de pagamento + nome de quem pagou) — esses dois campos vão
 * para o recibo gerado automaticamente ao confirmar (lib/receipts.ts).
 */
export function MarkInvoicePaidButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setOpen(true)}>
        <FileText size={12} /> Marcar como Paga
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-paper-line-strong bg-paper p-2"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await markInvoicePaid(invoiceId, formData);
          if (!res.success) {
            setError(res.error);
            return;
          }
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <select name="paidMethod" required className="input text-xs" defaultValue="">
        <option value="" disabled>
          Forma de pagamento
        </option>
        {PAID_METHOD_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <input name="payerName" placeholder="Quem pagou (nome)" className="input text-xs" />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary text-xs" disabled={isPending}>
          {isPending ? "Salvando…" : "Confirmar pagamento"}
        </button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(false)} disabled={isPending}>
          Cancelar
        </button>
      </div>
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
    </form>
  );
}
