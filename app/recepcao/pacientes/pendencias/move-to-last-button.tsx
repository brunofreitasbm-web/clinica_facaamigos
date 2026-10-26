"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, RotateCcw, Clock } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { moveQueueItemToEnd, restoreQueueItemToTop } from "./actions";

export function MoveToLastButton({
  itemId,
  patientName,
  isPostponed = false,
  compact = false,
}: {
  itemId: string;
  patientName: string;
  isPostponed?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleMoveToEnd = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();

    startTransition(async () => {
      const res = await moveQueueItemToEnd(itemId);
      if (!res.success) {
        toast(res.error, "error");
        return;
      }

      window.dispatchEvent(new CustomEvent("queue-item-moved-to-last", { detail: { id: itemId } }));
      router.refresh();

      toast(`${patientName} colocado(a) no fim da fila.`, "success", () => {
        startTransition(async () => {
          const undoRes = await restoreQueueItemToTop(itemId);
          if (undoRes.success) {
            router.refresh();
            toast(`${patientName} retornou ao topo da fila.`, "info");
          }
        });
      });
    });
  };

  const handleRestore = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();

    startTransition(async () => {
      const res = await restoreQueueItemToTop(itemId);
      if (!res.success) {
        toast(res.error, "error");
        return;
      }
      router.refresh();
      toast(`${patientName} retornou ao topo da fila.`, "success");
    });
  };

  if (compact) {
    if (isPostponed) {
      return (
        <button
          type="button"
          onClick={handleRestore}
          disabled={isPending}
          title="Item no fim da fila. Clique para priorizar"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-amber-600 transition-colors hover:bg-amber-100 disabled:opacity-50"
          aria-label="Priorizar item do fim da fila"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleMoveToEnd}
        disabled={isPending}
        title="Colocar para o último da fila (se não for relevante autorizar agora)"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-soft opacity-60 transition-all hover:bg-paper-line hover:text-ink hover:opacity-100 focus:opacity-100 disabled:opacity-30"
        aria-label="Colocar para o último da fila"
      >
        <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  }

  if (isPostponed) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
        <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
        <span>No fim da fila</span>
        <button
          type="button"
          onClick={handleRestore}
          disabled={isPending}
          className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold text-amber-900 underline hover:bg-amber-100 disabled:opacity-50"
          title="Mover de volta para o topo da fila"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          <span>{isPending ? "Restaurando…" : "Priorizar"}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleMoveToEnd}
      disabled={isPending}
      title="Se julgar que não é relevante autorizar agora, envie este contato para o fim da fila"
      className="inline-flex items-center gap-1.5 rounded-full border border-paper-line-strong bg-paper px-3 py-1 text-xs font-semibold text-ink-soft shadow-xs transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
    >
      <ArrowDownToLine className="h-3.5 w-3.5 text-ink-soft group-hover:text-amber-700" aria-hidden="true" />
      <span>{isPending ? "Movendo…" : "Colocar para o último da fila"}</span>
    </button>
  );
}
