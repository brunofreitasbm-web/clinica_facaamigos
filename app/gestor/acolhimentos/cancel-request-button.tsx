"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelAcolhimentoRequest } from "./actions";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className="text-xs font-semibold text-status-negative-text hover:underline disabled:opacity-50"
      onClick={() => {
        if (!window.confirm("Cancelar esta solicitação de acolhimento?")) return;
        startTransition(async () => {
          await cancelAcolhimentoRequest(requestId);
          router.refresh();
        });
      }}
    >
      Cancelar
    </button>
  );
}
