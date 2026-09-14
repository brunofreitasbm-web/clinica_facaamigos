"use client";

import { useState, useTransition } from "react";
import { changePassword } from "./actions";
import { PasswordStrengthChecklist } from "@/components/password-strength-checklist";
import { PASSWORD_MIN_LENGTH, isPasswordStrong } from "@/lib/password";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = isPasswordStrong(password) && passwordsMatch;

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
          minLength={PASSWORD_MIN_LENGTH}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
        />
        <PasswordStrengthChecklist password={password} />
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
          minLength={PASSWORD_MIN_LENGTH}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <span className="mt-1 block text-[11px] text-red-600">As senhas não conferem.</span>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending || !canSubmit}
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
