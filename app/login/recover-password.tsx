"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { PasswordStrengthChecklist } from "@/components/password-strength-checklist";
import { PASSWORD_MIN_LENGTH, isPasswordStrong } from "@/lib/password";
import { requestRecoveryCode, resetPasswordWithCode } from "@/lib/password-recovery";

const inputClass =
  "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart";
const labelClass = "text-xs font-medium uppercase tracking-wide text-ink-soft";

export function RecoverPassword({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"ask" | "code" | "done">("ask");
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const restart = () => {
    setStep("ask");
    setChallengeId("");
    setCode("");
    setPassword("");
    setConfirm("");
  };

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const r = await requestRecoveryCode(identifier);
      if (!r.ok) return setError(r.error);
      setChallengeId(r.challenge_id);
      setInfo(r.mensagem ?? "Se os dados conferem, enviamos um código para o e-mail cadastrado.");
      setStep("code");
    });
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const r = await resetPasswordWithCode(challengeId, code, password);
      if (!r.ok) {
        setError(r.error);
        if (r.restart) restart();
        return;
      }
      setStep("done");
    });
  };

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200">
          ✓ Senha alterada. Entre com a nova senha.
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper"
        >
          Ir para o login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={step === "ask" ? ask : reset} className="flex flex-col gap-4 text-left">
      {step === "ask" ? (
        <div>
          <label className={labelClass} htmlFor="recover-identifier">
            CPF ou e-mail
          </label>
          <input
            id="recover-identifier"
            type="text"
            autoComplete="username"
            placeholder="000.000.000-00"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
            className={inputClass}
          />
          <span className="mt-1 block text-[11px] text-ink-soft">
            Enviamos um código de 6 dígitos para o e-mail cadastrado. Sem e-mail cadastrado, fale com o gestor da
            clínica.
          </span>
        </div>
      ) : (
        <>
          {info && (
            <div className="rounded bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200">{info}</div>
          )}
          <div>
            <label className={labelClass} htmlFor="recover-code">
              Código de 6 dígitos
            </label>
            <input
              id="recover-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              className={`${inputClass} text-center text-xl tracking-widest font-mono`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="recover-password">
              Nova senha
            </label>
            <input
              id="recover-password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
            <PasswordStrengthChecklist password={password} />
          </div>
          <div>
            <label className={labelClass} htmlFor="recover-confirm">
              Confirmar nova senha
            </label>
            <input
              id="recover-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={inputClass}
            />
            {confirm.length > 0 && confirm !== password && (
              <span className="mt-1 block text-[11px] text-red-700">As senhas não conferem.</span>
            )}
          </div>
        </>
      )}

      {error && <div className="rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">{error}</div>}

      <button
        type="submit"
        disabled={
          isPending ||
          (step === "ask"
            ? identifier.trim().length < 5
            : code.length !== 6 || !isPasswordStrong(password) || password !== confirm)
        }
        className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {step === "ask" ? (isPending ? "Enviando…" : "Enviar código") : isPending ? "Salvando…" : "Salvar nova senha"}
      </button>

      <button type="button" onClick={onBack} className="text-xs text-ink-soft hover:text-ink underline">
        Voltar ao login
      </button>
    </form>
  );
}
