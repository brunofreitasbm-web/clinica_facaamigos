"use client";

import { useState, useTransition } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await signIn(formData);
          if (result && !result.success) {
            setError(result.error);
          }
        });
      }}
    >
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
