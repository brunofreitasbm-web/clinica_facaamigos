/**
 * Interessado cadastrado à mão pela recepção (sem contato de documentos do
 * WhatsApp) não tem guia nem linha do tempo de autorização: a única saída dele
 * na fila é lançar a guia autorizada ou marcar como particular, ali mesmo no
 * item. Sem isso o item "cadastro incompleto" só levava a uma lista que
 * esconde interessado, e o cadastro nunca chegava em Pacientes nem na Agenda.
 */
export function needsGuideAction(item: {
  category: string;
  patientId: string | null;
  patientStatus?: string | null;
  hasDraft: boolean;
}): boolean {
  if (item.hasDraft || !item.patientId) return false;
  if (item.patientStatus !== "interessado") return false;
  return item.category === "cadastro_incompleto" || item.category === "interessado_sem_retorno";
}
