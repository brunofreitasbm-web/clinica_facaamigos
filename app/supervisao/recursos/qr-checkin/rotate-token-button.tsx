"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rotateCheckinToken } from "./token-actions";

export function RotateTokenButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("Isso desativa o cartaz atual imediatamente. Você vai precisar reimprimir o novo. Continuar?")) return;
    setError(null);
    startTransition(async () => {
      const result = await rotateCheckinToken();
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={isPending} className="btn btn-secondary">
        Girar cartaz
      </button>
      {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}
    </div>
  );
}
