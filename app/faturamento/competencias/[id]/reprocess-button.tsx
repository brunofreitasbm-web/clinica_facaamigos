"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCompetence } from "../actions";

export function ReprocessButton({
  insurerId,
  monthStr,
}: {
  insurerId: string;
  monthStr: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleReprocess() {
    setError(null);
    startTransition(async () => {
      const result = await closeCompetence(insurerId, monthStr);
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
        onClick={handleReprocess}
        disabled={isPending}
        className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink hover:border-chart disabled:opacity-50"
      >
        {isPending ? "Reprocessando…" : "Reprocessar"}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
