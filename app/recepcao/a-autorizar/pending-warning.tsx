import type { ChaseKey } from "@/lib/lead-pendencies";
import { buildPendingWarning } from "@/lib/intake-actions-pure";

/** Aviso logo acima do botão "Enviar guia ao plano": documento faltando não bloqueia, só avisa. */
export function PendingWarning({ keys }: { keys: ChaseKey[] }) {
  const text = buildPendingWarning(keys);
  if (!text) return null;
  return (
    <p role="note" className="m-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
      {text}
    </p>
  );
}
