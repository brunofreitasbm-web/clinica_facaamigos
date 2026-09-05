"use client";

import { useState, useTransition } from "react";
import { updateInsurerProviderCode } from "./actions";

export function ProviderCodeInline({ insurerId, initialValue }: { insurerId: string; initialValue: string | null }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("insurer_id", insurerId);
      formData.set("provider_code", value);
      const result = await updateInsurerProviderCode(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="código do prestador"
        className="w-32 rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink"
      />
      {!saved && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md border border-paper-line-strong px-2 py-1 text-xs font-medium text-ink hover:bg-paper-subtle disabled:opacity-50"
        >
          {isPending ? "…" : "Salvar"}
        </button>
      )}
      {error && <span className="text-[11px] text-status-negative-text">{error}</span>}
    </span>
  );
}
