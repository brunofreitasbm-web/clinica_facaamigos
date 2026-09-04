"use client";

import { useState, useTransition } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"email" | "otp">("email");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-md border border-paper-line-strong p-1 bg-paper-darker text-xs">
        <button
          type="button"
          onClick={() => setMode("email")}
          className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${mode === "email" ? "bg-paper text-ink shadow-sm" : "text-ink-soft"}`}
        >
          Equipe (E-mail)
        </button>
        <button
          type="button"
          onClick={() => setMode("otp")}
          className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${mode === "otp" ? "bg-paper text-ink shadow-sm" : "text-ink-soft"}`}
        >
          Família (WhatsApp / OTP)
        </button>
      </div>

      {mode === "email" ? (
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
            {isPending ? "Entrando…" : "Entrar com e-mail"}
          </button>
          {error && <p className="text-xs text-status-negative-text">{error}</p>}
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          {!phoneSubmitted ? (
            <>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="phone">
                  Telefone / WhatsApp
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
                />
              </div>
              <button
                type="button"
                onClick={() => setPhoneSubmitted(true)}
                className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper"
              >
                Enviar código por WhatsApp
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="otp_code">
                  Código de 6 dígitos
                </label>
                <input
                  id="otp_code"
                  name="otp_code"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-center text-lg tracking-widest text-ink font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => window.location.href = "/familia"}
                className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper"
              >
                Confirmar e Entrar
              </button>
              <button
                type="button"
                onClick={() => setPhoneSubmitted(false)}
                className="text-xs text-ink-soft underline text-center"
              >
                Reenviar ou alterar telefone
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
