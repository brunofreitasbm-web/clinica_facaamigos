"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Check, X, ArrowLeft, KeyRound } from "lucide-react";
import { signIn } from "./actions";
import { requestFamilyOtp, verifyFamilyOtp } from "./otp-actions";
import { requestStaffPasswordReset, verifyStaffPasswordReset } from "./staff-recovery-actions";
import { formatCpfMask, formatPhoneMask } from "@/lib/masks";
import { PASSWORD_REQUIREMENTS, isPasswordStrong } from "@/lib/password";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"email" | "otp" | "recovery">("email");

  // Estados do formulário OTP da Família
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [cpf, setCpf] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [requiresCpf, setRequiresCpf] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Estados do formulário de Recuperação/Primeiro Acesso da Equipe
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState("");
  const [recoveryResetId, setRecoveryResetId] = useState("");
  const [recoveryMaskedEmail, setRecoveryMaskedEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [recoveryResendTimer, setRecoveryResendTimer] = useState(0);

  useEffect(() => {
    if (searchParams?.get("expired") === "true") {
      setError("Sua sessão expirou por inatividade. Por favor, faça login novamente.");
    }
    if (searchParams?.get("mode") === "recovery") {
      setMode("recovery");
      setRecoveryStep(1);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!phoneSubmitted || resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [phoneSubmitted, resendTimer]);

  useEffect(() => {
    if (recoveryStep !== 2 || recoveryResendTimer <= 0) return;
    const interval = setInterval(() => setRecoveryResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [recoveryStep, recoveryResendTimer]);

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

  // Handlers para recuperação da equipe
  const handleRequestRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await requestStaffPasswordReset(recoveryIdentifier);
      if (!res.success) {
        setError(res.error);
      } else {
        setRecoveryResetId(res.resetId);
        setRecoveryMaskedEmail(res.maskedEmail);
        setRecoveryStep(2);
        setRecoveryResendTimer(60);
        setSuccessMsg(`Código enviado para ${res.maskedEmail}`);
      }
    });
  };

  const handleVerifyRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setError("As senhas digitadas não conferem.");
      return;
    }

    if (!isPasswordStrong(recoveryNewPassword)) {
      setError("A senha não atende a todos os requisitos de segurança.");
      return;
    }

    startTransition(async () => {
      const res = await verifyStaffPasswordReset({
        resetId: recoveryResetId,
        code: recoveryCode,
        newPassword: recoveryNewPassword,
        confirmPassword: recoveryConfirmPassword,
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setSuccessMsg("Senha definida com sucesso! Entrando no sistema…");
        setTimeout(() => {
          window.location.href = "/";
        }, 800);
      }
    });
  };

  const handleResendRecovery = () => {
    if (recoveryResendTimer > 0 || isPending) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await requestStaffPasswordReset(recoveryIdentifier);
      if (!res.success) {
        setError(res.error);
      } else {
        setRecoveryResetId(res.resetId);
        setRecoveryResendTimer(60);
        setSuccessMsg("Novo código de 6 dígitos enviado por e-mail!");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {mode !== "recovery" ? (
        <div className="flex rounded-md border border-paper-line-strong p-1 bg-paper-darker text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("email");
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${
              mode === "email" ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            Equipe
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("otp");
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-sm font-medium transition-colors ${
              mode === "otp" ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            Família (SMS / OTP)
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-1 border-b border-paper-line">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <KeyRound className="h-3.5 w-3.5 text-chart" />
            <span>Primeiro acesso / Recuperar senha</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setMode("email");
              setError(null);
              setSuccessMsg(null);
            }}
            className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Voltar</span>
          </button>
        </div>
      )}

      {mode === "email" && (
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
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="identifier">
              CPF ou e-mail
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              placeholder="000.000.000-00 ou seu@email.com"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
            />
            <span className="mt-1 block text-[11px] text-ink-soft text-left">
              Colaboradores novos entram com CPF; contas antigas ainda podem usar e-mail.
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="password">
                Senha
              </label>
              <button
                type="button"
                onClick={() => {
                  setMode("recovery");
                  setRecoveryStep(1);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[11px] text-ink-soft hover:text-ink transition-colors underline-offset-2 hover:underline"
              >
                Esqueci / Primeiro acesso
              </button>
            </div>
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
            {isPending ? "Entrando…" : "Entrar"}
          </button>

          {error && (
            <div className="rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 text-left">
              {error}
            </div>
          )}
        </form>
      )}

      {mode === "recovery" && (
        <div className="flex flex-col gap-4 text-left">
          {recoveryStep === 1 ? (
            <form onSubmit={handleRequestRecovery} className="flex flex-col gap-4">
              <p className="text-xs text-ink-soft leading-relaxed">
                Informe seu <strong>CPF</strong> ou <strong>e-mail</strong> cadastrado na clínica.
                Enviaremos um código de 6 dígitos por e-mail para você criar ou redefinir sua senha.
              </p>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="recovery_identifier">
                  CPF ou e-mail
                </label>
                <input
                  id="recovery_identifier"
                  name="recovery_identifier"
                  type="text"
                  placeholder="000.000.000-00 ou seu@email.com"
                  value={recoveryIdentifier}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val.includes("@") && /^\d+$/.test(val.replace(/\D/g, ""))) {
                      setRecoveryIdentifier(formatCpfMask(val));
                    } else {
                      setRecoveryIdentifier(val);
                    }
                  }}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
                />
              </div>

              {error && (
                <div className="rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !recoveryIdentifier.trim()}
                className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? "Enviando código…" : "Enviar código de verificação"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("email");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-center text-ink-soft hover:text-ink underline"
              >
                Lembrou da senha? Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyRecovery} className="flex flex-col gap-4">
              <div className="rounded bg-paper-darker p-3 border border-paper-line text-xs text-ink-soft">
                Código de 6 dígitos enviado para <strong>{recoveryMaskedEmail}</strong>. Verifique sua caixa de entrada e spam.
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="recovery_code">
                  Código de 6 dígitos
                </label>
                <input
                  id="recovery_code"
                  name="recovery_code"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-center text-xl tracking-widest text-ink font-mono focus:outline-none focus:ring-1 focus:ring-chart"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="recovery_password">
                  Nova senha
                </label>
                <input
                  id="recovery_password"
                  name="recovery_password"
                  type="password"
                  autoComplete="new-password"
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
                />

                <div className="mt-2 space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const valid = req.test(recoveryNewPassword);
                    return (
                      <div
                        key={req.key}
                        className={`flex items-center gap-1.5 text-[11px] ${
                          valid ? "text-emerald-700 font-medium" : "text-ink-soft"
                        }`}
                      >
                        {valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>{req.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="recovery_confirm">
                  Confirmar nova senha
                </label>
                <input
                  id="recovery_confirm"
                  name="recovery_confirm"
                  type="password"
                  autoComplete="new-password"
                  value={recoveryConfirmPassword}
                  onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-chart"
                />
                {recoveryConfirmPassword && recoveryNewPassword !== recoveryConfirmPassword && (
                  <span className="mt-1 block text-[11px] text-red-600">
                    As senhas não conferem.
                  </span>
                )}
              </div>

              {successMsg && (
                <div className="rounded bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200">
                  ✓ {successMsg}
                </div>
              )}

              {error && (
                <div className="rounded bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isPending ||
                  recoveryCode.length !== 6 ||
                  !isPasswordStrong(recoveryNewPassword) ||
                  recoveryNewPassword !== recoveryConfirmPassword
                }
                className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? "Salvando nova senha…" : "Salvar nova senha e entrar"}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleResendRecovery}
                  disabled={recoveryResendTimer > 0 || isPending}
                  className="text-ink-soft hover:text-ink disabled:opacity-50 underline"
                >
                  {recoveryResendTimer > 0
                    ? `Reenviar código em ${recoveryResendTimer}s`
                    : "Reenviar código"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRecoveryStep(1);
                    setRecoveryCode("");
                    setRecoveryNewPassword("");
                    setRecoveryConfirmPassword("");
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-ink-soft hover:text-ink underline"
                >
                  Alterar e-mail/CPF
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {mode === "otp" && (
        <div className="flex flex-col gap-4">
          {!phoneSubmitted ? (
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-4 text-left">
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
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4 text-left">
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
