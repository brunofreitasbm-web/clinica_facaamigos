// lib/authorization-warning.ts
//
// Lógica pura de aviso de guia/autorização no check-in, extraída de
// `buildAuthorizationWarning` (app/recepcao/agenda/session-actions.ts) para
// ser reaproveitada pelo cupom de check-in (lib/checkin-coupon.ts via
// app/recepcao/agenda/coupon-actions.ts) sem refazer o SELECT por sessão —
// o cupom já embutiu `authorizations(...)` na consulta do dia inteiro.
//
// `buildAuthorizationWarning` continua existindo em session-actions.ts como
// um wrapper fino (query + chamada a esta função) — mesmo comportamento,
// sem regressão no check-in em si.

export type AuthorizationWarningInput = {
  authorizationId: string | null;
  isProvisional: boolean | null;
  isEvaluation: boolean | null;
  authorization: {
    status: string;
    validFrom: string;
    validTo: string;
    sessionsUsed: number;
    sessionsAuthorized: number;
    passwordValidUntil: string | null;
  } | null;
};

/**
 * Avalia se uma sessão deveria exibir um aviso de guia/convênio no check-in.
 * `today` é a data civil (`YYYY-MM-DD`) da clínica — ver `todayInTimeZone`.
 * Não bloqueia nada; é só o texto pra UI mostrar (ou undefined se tudo ok).
 */
export function evaluateAuthorizationWarning(
  input: AuthorizationWarningInput,
  today: string,
): string | undefined {
  if (input.isEvaluation || input.isProvisional) {
    return undefined;
  }

  if (!input.authorizationId) {
    return "Sessão sem guia de convênio vinculada.";
  }

  const authorization = input.authorization;
  if (!authorization) {
    return "Guia vinculada não foi encontrada.";
  }

  if (authorization.status !== "ativa") {
    return "Guia vinculada não está mais ativa.";
  }
  if (today < authorization.validFrom || today > authorization.validTo) {
    return "Sessão fora da vigência da guia.";
  }
  if (authorization.sessionsUsed >= authorization.sessionsAuthorized) {
    return "Guia sem sessões restantes.";
  }
  if (authorization.passwordValidUntil && authorization.passwordValidUntil < today) {
    return "Senha de autorização da guia está vencida.";
  }

  return undefined;
}
