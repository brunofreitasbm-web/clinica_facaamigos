"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closePayouts } from "@/app/faturamento/repasses/actions";
import { competenceLabel } from "@/lib/competence-label-pure";

/**
 * "Fechar repasses do mês" com confirmação (FIN-02). Antes rodava no primeiro clique, sem
 * dizer qual mês nem o que acontece. Agora o botão já nomeia o mês e o clique abre um
 * resumo; só o segundo clique recalcula. Usado no Gestor (Financeiro) e no Faturamento.
 */
export function ClosePayoutsConfirm({ competenceMonth, buttonClassName }: { competenceMonth: string; buttonClassName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const label = competenceLabel(competenceMonth);

  function handleClose() {
    setMessage(null);
    startTransition(async () => {
      const result = await closePayouts(competenceMonth);
      setConfirming(false);
      if (!result.success) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      const skippedNote = result.skipped.length > 0 ? ` · não incluídos: ${result.skipped.join(", ")}` : "";
      setMessage({ kind: "success", text: `${result.closedCount} repasse(s) fechado(s) em ${label}${skippedNote}.` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex max-w-sm flex-col items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 text-right shadow-2xs">
          <p className="m-0 text-sm font-semibold text-slate-800">Fechar os repasses de {label}?</p>
          <p className="m-0 text-xs text-slate-600">
            Recalcula os repasses em aberto de todos os terapeutas. Repasses já aprovados ou pagos não mudam.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={isPending} onClick={() => setConfirming(false)} className="btn btn-secondary text-xs">
              Cancelar
            </button>
            <button type="button" disabled={isPending} onClick={handleClose} className="btn btn-primary text-xs">
              {isPending ? "Fechando…" : `Fechar ${label}`}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setMessage(null); setConfirming(true); }} className={buttonClassName}>
          Fechar repasses de {label}
        </button>
      )}
      {message && (
        <p className="m-0 text-xs" style={{ color: message.kind === "error" ? "var(--status-falta)" : "var(--color-accent-2-600)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
