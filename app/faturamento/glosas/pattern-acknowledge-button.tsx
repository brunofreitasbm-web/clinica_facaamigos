"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeGlosaPattern } from "./actions";

/**
 * Botão "Reconhecer" no destaque de padrão recorrente (ver page.tsx) — a
 * única transição manual de `glosa_recurring_patterns.status`, mesmo
 * espírito de GlosaRowActions.handleMarkAppealed.
 */
export function PatternAcknowledgeButton({ patternId }: { patternId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleAcknowledge() {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeGlosaPattern(patternId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleAcknowledge}
        disabled={isPending}
        className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink hover:border-chart disabled:opacity-50"
      >
        {isPending ? "Marcando…" : "Reconhecer"}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
