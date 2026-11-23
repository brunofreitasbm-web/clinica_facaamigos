"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GuiaQuickActionModal } from "../../guia-quick-action-modal";
import { markInteressadoParticular } from "./interessado-actions";

/**
 * Ação primária do interessado cadastrado à mão: lançar a guia autorizada pelo
 * plano (ação principal) ou marcar como particular (secundária). Os dois
 * promovem o cadastro a "avaliação", e ele passa a aparecer em Pacientes e na
 * Agenda de 1ª avaliação.
 */
export function InteressadoGuideAction({ patientId, patientName }: { patientId: string; patientName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markParticular() {
    setError(null);
    startTransition(async () => {
      const res = await markInteressadoParticular(patientId);
      if (res.success) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={isPending} onClick={() => setOpen(true)}>
          Lançar guia autorizada
        </button>
        <button type="button" className="btn btn-secondary" disabled={isPending} onClick={markParticular}>
          {isPending ? "Salvando…" : "É particular"}
        </button>
      </div>
      {error && <p className="m-0 text-[13px] text-status-negative-text">{error}</p>}
      <GuiaQuickActionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        patientId={patientId}
        patientName={patientName}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
