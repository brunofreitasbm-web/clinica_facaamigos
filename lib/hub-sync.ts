// Headers da chamada do login da Clínica para `sincronizar_login_clinica` no Hub de Gestão.
// O segredo compartilhado (GESTAO_SYNC_SECRET, o mesmo valor configurado na função do Hub) autentica o
// servidor da Clínica; só com ele o Hub aceita o IP real do usuário para o limite de tentativas por IP.
// Sem segredo configurado, manda só o Content-Type (comportamento anterior, para a transição).
export function cabecalhosSincronizacaoHub(
  segredo: string | undefined,
  ipCliente: string | null,
): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!segredo) return headers;
  headers["x-gestao-sync-secret"] = segredo;
  const ip = (ipCliente ?? "").split(",")[0].trim();
  if (ip) headers["x-cliente-ip"] = ip.slice(0, 64);
  return headers;
}
