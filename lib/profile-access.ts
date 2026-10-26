// Quem a Clínica deixa entrar, do ponto de vista do cadastro do colaborador.
//
// `profiles.active = false` é "colaborador desativado" (a tela de Equipe do gestor e o Hub de Gestão
// marcam isso). Até aqui o campo só escondia a pessoa de listas e métricas: nem o middleware nem o
// login o consultavam, então um colaborador desativado continuava entrando. Agora o middleware recusa
// a sessão de quem está desativado e o login é banido no Auth (ver toggleStaffActive), para valer
// também na renovação do token.
//
// A família (`responsavel`) fica de fora: o acesso dela é por telefone/OTP e `active` não é "ex-colaborador".

export const BAN_PERMANENTE = "876000h"; // ~100 anos; no Auth, "none" levanta o banimento
export const BAN_LEVANTADO = "none";

type ProfileAcesso = { role?: string | null; active?: boolean | null } | null | undefined;

/** Só `active === false` bloqueia; sem perfil ou campo nulo/ausente segue como antes. */
export function isProfileBlocked(profile: ProfileAcesso): boolean {
  if (!profile) return false;
  if (profile.role === "responsavel") return false;
  return profile.active === false;
}

export function banDurationFor(active: boolean): string {
  return active ? BAN_LEVANTADO : BAN_PERMANENTE;
}
