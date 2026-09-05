"use client";

import { useTransition } from "react";
import { deleteTarget } from "./actions";

export function DeleteTargetButton({ targetId }: { targetId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await deleteTarget(targetId);
        })
      }
      className="text-xs text-status-negative-text underline disabled:opacity-50"
    >
      {isPending ? "Removendo…" : "Remover"}
    </button>
  );
}
