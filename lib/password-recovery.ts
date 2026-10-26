// "Esqueci minha senha" da Clínica. O código de 6 dígitos e a troca da senha são feitos pela função
// `recuperar-senha` (projeto A), que fala com o login desta Clínica. Aqui só há a chamada e a leitura
// da resposta, sem regra de segurança: limite de tentativas, validade do código e quem pode recuperar
// ficam no servidor.

const DEFAULT_URL = "https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/recuperar-senha";

export function recoveryUrl(): string {
  return process.env.NEXT_PUBLIC_RECUPERAR_SENHA_URL || DEFAULT_URL;
}

export type RecoveryResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; restart: boolean };

async function call<T>(body: Record<string, unknown>, fetchImpl: typeof fetch): Promise<RecoveryResult<T>> {
  try {
    const res = await fetchImpl(recoveryUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Não foi possível concluir agora. Tente de novo.",
        restart: data.reiniciar === true,
      };
    }
    return { ok: true, ...(data as T) };
  } catch {
    return { ok: false, error: "Sem conexão. Confira a internet e tente de novo.", restart: false };
  }
}

/** Pede o código. A resposta é a mesma exista a conta ou não; sem e-mail real cadastrado nada chega. */
export function requestRecoveryCode(identifier: string, fetchImpl: typeof fetch = fetch) {
  return call<{ challenge_id: string; mensagem?: string }>(
    { action: "pedir", sistema: "clinica", identificador: identifier.trim() },
    fetchImpl,
  );
}

export function resetPasswordWithCode(
  challengeId: string,
  code: string,
  newPassword: string,
  fetchImpl: typeof fetch = fetch,
) {
  return call({ action: "redefinir", challenge_id: challengeId, code: code.replace(/\D/g, ""), new_password: newPassword }, fetchImpl);
}
