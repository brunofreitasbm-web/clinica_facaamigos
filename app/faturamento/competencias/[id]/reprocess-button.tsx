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
      <button type="button" onClick={handleReprocess} disabled={isPending} className="btn btn-secondary">
        {isPending ? "Reprocessando…" : "Reprocessar"}
      </button>
      {error && (
        <p className="text-xs" style={{ color: "var(--status-falta)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
