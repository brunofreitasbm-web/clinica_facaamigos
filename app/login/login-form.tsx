"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { signIn } from "./actions";
import { requestFamilyOtp, verifyFamilyOtp } from "./otp-actions";

function formatPhoneMask(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpfMask(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"email" | "otp">("email");

  // Estados do formulário OTP da Família
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [cpf, setCpf] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [requiresCpf, setRequiresCpf] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (!phoneSubmitted || resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [phoneSubmitted, resendTimer]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneMask(e.target.value));
  };

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await requestFamilyOtp(phone);
      if (!res.success) {
        setError(res.error || "Erro ao solicitar código.");
      } else {
        setPhoneSubmitted(true);
        setResendTimer(60);
        setSuccessMsg(res.message || "Código enviado com sucesso!");
      }
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await verifyFamilyOtp(phone, otpCode, requiresCpf ? cpf : undefined);
      if (!res.success) {
        setError(res.error || "Erro ao verificar código.");
        if (res.requiresCpf) setRequiresCpf(true);
      }
    });
  };

  const handleResendOtp = () => {
    if (resendTimer > 0 || isPending) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await requestFamilyOtp(phone);
      if (!res.success) {
        setError(res.error || "Erro ao reenviar código.");
      } else {
        setResendTimer(60);
        setSuccessMsg("Um novo código de 6 dígitos foi enviado!");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-md border border-paper-line-strong p-1 bg-paper-darker text-xs">
        <button
          type="button"
          onClick={() => {
            setMode("email");
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${
            mode === "email" ? "bg-paper text-ink shadow-sm" : "text-ink-soft"
          }`}
        >
          Equipe (E-mail)
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("otp");
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${
            mode === "otp" ? "bg-paper text-ink shadow-sm" : "text-ink-soft"
          }`}
        >
          Família (SMS / OTP)
        </button>
      </div>

      {mode === "email" ? (
        <form
          className="flex flex-col gap-4"
          action={(formData) => {
            setError(null);
            setSuccessMsg(null);
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
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
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
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? "Entrando…" : "Entrar com e-mail"}
          </button>

          {error && (
            <div className="rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          {!phoneSubmitted ? (
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="phone">
                  Telefone (SMS) do Responsável
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
                />
                <span className="mt-1 block text-[11px] text-ink-soft">
                  Utilize o mesmo número cadastrado na recepção da clínica.
                </span>
              </div>

              <button
                type="submit"
                disabled={isPending || phone.replace(/\D/g, "").length < 10}
                className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? "Verificando cadastro…" : "Receber Código de Acesso"}
              </button>

              {error && (
                <div className="rounded bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 leading-relaxed">
                  ⚠️ {error}
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="otp_code">
                    Código de 6 dígitos
                  </label>
                  <span className="text-xs text-ink-soft">Enviado para {phone}</span>
                </div>
                <input
                  id="otp_code"
                  name="otp_code"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-center text-xl tracking-widest text-ink font-mono focus:outline-none focus:ring-1 focus:ring-chart"
                />
              </div>

              {requiresCpf && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="cpf">
                    CPF do responsável
                  </label>
                  <input
                    id="cpf"
                    name="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={cpf}
                    onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                    required
                    className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
                  />
                  <span className="mt-1 block text-[11px] text-ink-soft">
                    Primeiro acesso: confirme o CPF cadastrado na recepção da clínica.
                  </span>
                </div>
              )}

              {successMsg && (
                <div className="rounded bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200">
                  ✓ {successMsg}
                </div>
              )}

              {error && (
                <div className="rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || otpCode.length !== 6 || (requiresCpf && cpf.replace(/\D/g, "").length !== 11)}
                className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? "Validando…" : "Confirmar e Entrar"}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || isPending}
                  className="text-ink-soft hover:text-ink disabled:opacity-50 underline"
                >
                  {resendTimer > 0 ? `Reenviar código em ${resendTimer}s` : "Reenviar código"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPhoneSubmitted(false);
                    setOtpCode("");
                    setCpf("");
                    setRequiresCpf(false);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-ink-soft hover:text-ink underline"
                >
                  Alterar telefone
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
