"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-chart">
            Acesso da equipe
          </span>
          <svg
            viewBox="0 0 120 10"
            className="h-2.5 flex-1 text-chart"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1="0"
              y1="5"
              x2="120"
              y2="5"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {[0, 20, 40, 60, 80, 100, 120].map((x) => (
              <line
                key={x}
                x1={x}
                y1="1"
                x2={x}
                y2={x % 40 === 0 ? "9" : "6"}
                stroke="currentColor"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">
          Sistema FaçaAmigos
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Entre com o e-mail e a senha da sua conta de equipe. Cada papel cai
          direto na sua própria home.
        </p>

        <form
          className="mt-8 flex flex-col gap-4 rounded-md border border-paper-line-strong bg-paper/60 p-6 shadow-[0_1px_0_0_var(--color-paper-line-strong)]"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await login(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              router.push(result.redirectTo);
            });
          }}
        >
          <div>
            <label
              className="text-xs font-medium uppercase tracking-wide text-ink-soft"
              htmlFor="email"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-chart"
            />
          </div>
          <div>
            <label
              className="text-xs font-medium uppercase tracking-wide text-ink-soft"
              htmlFor="password"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-chart"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="mt-2 rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-chart-strong disabled:opacity-50"
          >
            {isPending ? "Entrando…" : "Entrar"}
          </button>
          {error && (
            <p
              role="alert"
              className="rounded-full bg-status-negative-soft px-3 py-1.5 text-xs font-medium text-status-negative-text"
            >
              {error}
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-ink-faint">
          Responsável de paciente? O acesso da família é por telefone, ainda
          não disponível nesta fase.
        </p>
      </div>
    </main>
  );
}
