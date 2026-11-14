// Logout automático diário: toda sessão iniciada antes do último corte das 19h
// (horário de Brasília) é encerrada. Regra pura e stateless: compara o
// `last_sign_in_at` do Auth (que NÃO muda na renovação do token, só em login
// novo) com o corte mais recente. Sem cron, vale para todas as contas.

export const CORTE_HORA_BRASILIA = 19;
const BRASILIA_OFFSET_H = 3; // America/Sao_Paulo é UTC-3 fixo (sem horário de verão desde 2019)

/** Instante (UTC) do corte das 19h de Brasília mais recente que já passou em `agora`. */
export function ultimoCorte(agora: Date): Date {
  const corteHojeUtc = Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate(),
    CORTE_HORA_BRASILIA + BRASILIA_OFFSET_H, // 22h UTC (Date.UTC normaliza o dia se passar de 24)
  );
  // 19h BRT = 22h UTC do mesmo dia; se ainda não chegou, vale o de ontem.
  const hoje = new Date(corteHojeUtc);
  return hoje.getTime() <= agora.getTime() ? hoje : new Date(corteHojeUtc - 24 * 3600 * 1000);
}

/** true quando o login é anterior ao último corte (sessão deve cair). Sem data válida, não derruba. */
export function sessaoVencidaPeloCorte(lastSignInAt: string | null | undefined, agora: Date = new Date()): boolean {
  if (!lastSignInAt) return false;
  const login = new Date(lastSignInAt).getTime();
  if (Number.isNaN(login)) return false;
  return login < ultimoCorte(agora).getTime();
}
