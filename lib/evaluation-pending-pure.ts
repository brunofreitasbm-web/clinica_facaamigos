/**
 * Avaliação realmente aguardando o OK da Supervisão. is_provisional sozinho não
 * basta: auto_resolve_appointments() mantém is_provisional=true em avaliações
 * já realizadas (a flag também significa "sem autorização, não cobrar").
 * Consulta confirmada, com check-in ou realizada nunca aparece como pendente.
 */
export function aguardaConfirmacao(a: {
  isProvisional?: boolean;
  status?: string;
  confirmedAt?: string | null;
  checkinAt?: string | null;
}): boolean {
  return Boolean(a.isProvisional) && a.status === "agendada" && !a.confirmedAt && !a.checkinAt;
}
