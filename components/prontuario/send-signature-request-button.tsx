"use client";

import { useState, useTransition } from "react";
import { sendSignatureRequestWhatsApp } from "@/app/recepcao/pacientes/[id]/documents-actions";

export function SendSignatureRequestButton({ documentId }: { documentId: string }) {
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            const result = await sendSignatureRequestWhatsApp(documentId);
            if (!result.success) {
              setFeedback({ type: "error", text: result.error });
              return;
            }
            setFeedback({ type: "success", text: result.message });
          });
        }}
        className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink hover:border-chart disabled:opacity-50"
      >
        {isPending ? "Enviando…" : "Enviar para assinatura"}
      </button>
      {feedback && (
        <p className={`text-xs ${feedback.type === "success" ? "text-status-positive-text" : "text-status-negative-text"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
