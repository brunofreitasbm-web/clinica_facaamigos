// lib/evaluation-recipient-pure.ts
// Quem recebe o WhatsApp de confirmação da 1ª avaliação. Puro, sem I/O: o
// diálogo da supervisão e o envio no servidor usam a MESMA regra, pra tela
// nunca mostrar um responsável e a mensagem sair pra outro.

export type GuardianContact = {
  full_name: string | null;
  phone: string | null;
  is_financial: boolean | null;
};

export type EvaluationRecipient = {
  name: string | null;
  /** Primeiro nome pro `{{1}}` do template; "família" quando não há nome. */
  firstName: string;
  phone: string;
};

/**
 * Escolhe o responsável que recebe o aviso entre os cadastrados do paciente.
 * Devolve null quando ninguém tem telefone — o chamador avisa a supervisão
 * em vez de falhar em silêncio.
 */
export function pickEvaluationRecipient(guardians: GuardianContact[]): EvaluationRecipient | null {
  // TODO(human): implementar a regra de escolha (ver tests/evaluation-recipient-pure.test.ts).
  void guardians;
  return null;
}
