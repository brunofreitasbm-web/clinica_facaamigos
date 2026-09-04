"use client";

import { useState, useTransition, type ReactNode } from "react";

export function StageActionForm({
  action,
  children,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<{ success: true } | { success: false; error: string }>;
  children: ReactNode;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.success) setError(result.error);
        });
      }}
    >
      {children}
      <button type="submit" disabled={isPending} className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
        {isPending ? "Salvando…" : submitLabel}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
