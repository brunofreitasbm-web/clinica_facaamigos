"use client";

import { useState, useTransition } from "react";
import { getDocumentUrl } from "./documents-actions";

export function DocumentViewButton({ documentId }: { documentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await getDocumentUrl(documentId);
            if (!result.success) {
              setError(result.error);
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          });
        }}
        className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink hover:border-chart disabled:opacity-50"
      >
        {isPending ? "Abrindo…" : "Ver documento"}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
