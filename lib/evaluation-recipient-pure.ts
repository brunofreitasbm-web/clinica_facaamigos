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

function cleanPhone(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

function extractFirstName(rawName: string | null | undefined): string {
  const trimmed = (rawName ?? "").trim();
  if (!trimmed) return "família";
  const first = trimmed.split(/\s+/)[0];
  return first || "família";
}

/**
 * Escolhe o responsável que recebe o aviso entre os cadastrados do paciente.
 * Devolve null quando ninguém tem telefone — o chamador avisa a supervisão
 * em vez de falhar em silêncio.
 */
export function pickEvaluationRecipient(guardians: GuardianContact[]): EvaluationRecipient | null {
  if (!guardians || guardians.length === 0) return null;

  // Filtra apenas guardiões com telefone preenchido
  const withPhone = guardians.filter((g) => cleanPhone(g.phone).length > 0);
  if (withPhone.length === 0) return null;

  // Preferência para o responsável financeiro com telefone
  const selected = withPhone.find((g) => g.is_financial) ?? withPhone[0];
  if (!selected || !selected.phone) return null;

  const rawName = selected.full_name?.trim() || null;
  return {
    name: rawName,
    firstName: extractFirstName(rawName),
    phone: cleanPhone(selected.phone),
  };
}
