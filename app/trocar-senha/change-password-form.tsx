"use client";

import { useState, useTransition } from "react";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await changePassword(formData);
          if (result && !result.success) {
            setError(result.error);
          }
        });
      }}
    >
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="password">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="confirmPassword">
          Confirmar nova senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 transition-opacity"
      >
        {isPending ? "Salvando…" : "Salvar nova senha"}
      </button>

      {error && (
        <div className="rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}
    </form>
  );
}
