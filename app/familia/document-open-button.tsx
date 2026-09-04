"use client";

import { useState, useTransition } from "react";
import { getFamilyDocumentUrl } from "./actions";

export function DocumentOpenButton({ documentId }: { documentId: string }) {
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
            const result = await getFamilyDocumentUrl(documentId);
            if (!result.success) {
              setError(result.error);
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          });
        }}
        className="btn btn-ghost"
        style={{ fontSize: 13 }}
      >
        {isPending ? "Abrindo…" : "Abrir"}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: "var(--status-falta)" }}>{error}</p>
      )}
    </div>
  );
}
