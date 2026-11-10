// lib/intake-actions-pure.ts
// Textos da Fila de entrada: a mensagem única de cobrança à família e o aviso de pendência
// que fica acima do botão "Enviar guia ao plano".
// PURO, sem import com alias `@/` (o import de clinic-identity é relativo e só usa a constante).

import { CLINIC_BRAND } from "./clinic-identity.ts";
import type { ChaseKey } from "./lead-pendencies.ts";

/** Ordem fixa dos itens, a mesma das cobranças por documento. */
export const CHASE_KEY_ORDER: ChaseKey[] = ["laudo_medico", "pedido_medico", "carteirinha", "documento_responsavel"];

/** Nome curto do item no aviso da tela. */
const WARNING_LABEL: Record<ChaseKey, string> = {
  laudo_medico: "laudo",
  pedido_medico: "pedido médico",
  carteirinha: "carteirinha",
  documento_responsavel: "documento do responsável",
};

/**
 * Nome do documento na mensagem à família. Mesmo texto de `documentName` em
 * lib/document-request-templates.ts (que não é puro): mudou lá, muda aqui.
 */
const MESSAGE_NAME: Record<ChaseKey, string> = {
  laudo_medico: "*laudo médico* (com o CID)",
  pedido_medico: "*pedido médico* atualizado, com o CID e a quantidade de sessões",
  carteirinha: "*carteirinha do plano de saúde* (frente e verso, com a validade legível)",
  documento_responsavel: "*documento do responsável* (RG ou CNH, com CPF)",
};

/** Sem repetição e na ordem fixa; chaves desconhecidas ficam de fora. */
export function normalizeChaseKeys(keys: readonly string[]): ChaseKey[] {
  return CHASE_KEY_ORDER.filter((k) => keys.includes(k));
}

/** "a", "a e b", "a, b e c". */
export function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/**
 * Aviso logo acima do botão da etapa 2. Documento faltando não bloqueia o envio da guia,
 * só avisa: "Faltam laudo e pedido médico. O plano pode negar." Sem pendência, null.
 */
export function buildPendingWarning(keys: readonly ChaseKey[]): string | null {
  const list = normalizeChaseKeys(keys);
  if (list.length === 0) return null;
  const verb = list.length === 1 ? "Falta" : "Faltam";
  return `${verb} ${joinPt(list.map((k) => WARNING_LABEL[k]))}. O plano pode negar.`;
}

/**
 * Uma única mensagem de WhatsApp com tudo o que falta, cada item uma vez.
 * `patientName` é opcional: sem nome, o texto fala "da criança".
 * Com nenhum item, devolve string vazia (não há o que cobrar).
 */
export function buildChaseMessage(keys: readonly ChaseKey[], patientName?: string | null): string {
  const list = normalizeChaseKeys(keys);
  if (list.length === 0) return "";
  const first = patientName?.trim().split(/\s+/)[0];
  const child = first ? `do(a) ${first}` : "da criança";
  const intro = `Para darmos andamento ao pedido de autorização ${child} junto ao plano de saúde,`;
  const middle =
    list.length === 1
      ? [`${intro} ainda está faltando o ${MESSAGE_NAME[list[0]]}.`]
      : [`${intro} ainda estão faltando estes documentos:`, "", ...list.map((k) => `• ${MESSAGE_NAME[k]}`)];
  const waiting =
    list.length === 1
      ? "Enquanto esse documento não chega, o pedido de autorização fica parado e não conseguimos agendar o início do atendimento."
      : "Enquanto esses documentos não chegam, o pedido de autorização fica parado e não conseguimos agendar o início do atendimento.";
  return [
    `Olá! Aqui é da ${CLINIC_BRAND}. 💙`,
    "",
    ...middle,
    "",
    "Pode enviar por aqui mesmo: uma foto legível ou o PDF já resolve.",
    "",
    `${waiting} Qualquer dúvida, é só responder nesta conversa. Obrigado! 🙂`,
  ].join("\n");
}
