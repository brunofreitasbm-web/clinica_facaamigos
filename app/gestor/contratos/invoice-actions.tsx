"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText } from "lucide-react";
import { createPixAuthorization, generateMonthlyInvoice, markInvoicePaid } from "./actions";

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
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await markInvoicePaid(invoiceId, reason);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setAsking(false);
      router.refresh();
    });
  }

  if (!asking) {
    return (
      <button type="button" className="btn btn-ghost text-xs flex items-center gap-1" onClick={() => setAsking(true)}>
        <FileText size={12} /> Baixa manual
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        className="input text-xs"
        placeholder="Motivo (ex.: pagou em dinheiro na recepção)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Motivo da baixa manual"
      />
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={confirm} disabled={isPending}>
          {isPending ? "Salvando…" : "Confirmar baixa"}
        </button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setAsking(false)} disabled={isPending}>
          Cancelar
        </button>
      </div>
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
    </div>
  );
}

export function PixAuthorizationButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await createPixAuthorization(contractId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setQr(res.qrPayload);
      router.refresh();
    });
  }

  async function copy() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {!qr && (
        <button type="button" className="btn btn-ghost text-xs flex items-center gap-1" onClick={handleClick} disabled={isPending}>
          <Send size={12} /> {isPending ? "Gerando…" : "Gerar autorização Pix Automático"}
        </button>
      )}
      {qr && (
        <>
          <span className="text-[11px] text-ink-faint">Envie ao responsável. Ao pagar este Pix, ele autoriza os débitos dos próximos meses.</span>
          <textarea readOnly className="input text-[11px]" rows={3} value={qr} aria-label="Pix copia e cola da 1ª mensalidade" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-ghost text-xs" onClick={copy}>
            {copied ? "Copiado" : "Copiar código Pix"}
          </button>
        </>
      )}
      {error && <span className="text-[11px]" style={{ color: "var(--status-falta)" }}>{error}</span>}
    </div>
  );
}
