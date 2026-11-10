// lib/fila/fila-action-policy-pure.ts
// Política das ações da Fila de entrada. PURO, sem import com alias `@/`.
//
// Regra do dono do projeto:
//   - ação que manda WhatsApp (pedir documentos, lembrete, mensagem de abertura, habilitar o agendamento e
//     "Plano autorizou", que habilita e dispara a oferta de horários) pede conferência antes e não tem
//     Desfazer: mensagem enviada não se recolhe;
//   - as demais (guia enviada, guia não enviada, particular sem guia, plano negou, plano pediu mais
//     documentos) vão direto e mostram Desfazer por 8 segundos.

export type FilaActionKey =
  | "ask_documents"
  | "remind"
  | "more_docs_request"
  | "opener"
  | "guide_sent"
  | "guide_not_sent"
  | "waive"
  | "plan_denied"
  | "plan_more_docs"
  | "authorize_and_enable"
  | "enable_scheduling";

export type FilaActionPolicy = { sendsWhatsApp: boolean; confirm: boolean; undo: boolean };

const whatsapp: FilaActionPolicy = { sendsWhatsApp: true, confirm: true, undo: false };
const reversible: FilaActionPolicy = { sendsWhatsApp: false, confirm: false, undo: true };

export const FILA_ACTION_POLICY: Record<FilaActionKey, FilaActionPolicy> = {
  ask_documents: whatsapp,
  remind: whatsapp,
  more_docs_request: whatsapp,
  opener: whatsapp,
  authorize_and_enable: whatsapp,
  enable_scheduling: whatsapp,
  guide_sent: reversible,
  guide_not_sent: reversible,
  waive: reversible,
  plan_denied: reversible,
  plan_more_docs: reversible,
};

/** A ação mostra o que vai acontecer e espera o clique de confirmação? */
export function actionConfirms(key: FilaActionKey): boolean {
  return FILA_ACTION_POLICY[key].confirm;
}

/** A ação mostra o aviso com Desfazer quando dá certo? */
export function actionOffersUndo(key: FilaActionKey): boolean {
  return FILA_ACTION_POLICY[key].undo;
}
