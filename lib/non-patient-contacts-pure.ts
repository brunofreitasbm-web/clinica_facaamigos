// lib/non-patient-contacts-pure.ts
//
// Regras puras (sem imports "@/") do botão "Não é paciente" de Autorizações e
// do chat. Testadas em tests/non-patient-contacts-pure.test.ts.

export const NON_PATIENT_REASONS = [
  { value: "duvida", label: "Só dúvida / informação" },
  { value: "publicidade", label: "Publicidade / propaganda" },
  { value: "fornecedor", label: "Fornecedor / parceiro" },
  { value: "candidato", label: "Currículo / vaga de emprego" },
  { value: "engano", label: "Número errado / engano" },
  { value: "outro", label: "Outro" },
] as const;

export type NonPatientReasonValue = (typeof NON_PATIENT_REASONS)[number]["value"];

/**
 * Texto gravado em `non_patient_contacts.reason` e no `reject_reason` do
 * rascunho. "Outro" exige detalhe; nos demais o detalhe é opcional.
 * Devolve null quando a combinação é inválida.
 */
export function buildNonPatientReason(value: string, detail?: string | null): string | null {
  const option = NON_PATIENT_REASONS.find((o) => o.value === value);
  if (!option) return null;
  const extra = (detail ?? "").trim().slice(0, 300);
  if (option.value === "outro") return extra ? `Outro: ${extra}` : null;
  return extra ? `${option.label}: ${extra}` : option.label;
}

/** `reject_reason` do rascunho arquivado pela marcação (prefixo fixo para relatórios distinguirem de rejeição por documento ruim). */
export function nonPatientDraftRejectReason(reason: string): string {
  return `Não é paciente: ${reason}`;
}

/**
 * O contato marcado como "não é paciente" passou a dar ao robô de agendamento
 * dado da criança (nome, nascimento ou carteirinha)? Isso é intenção real de
 * terapia: a marcação cai sozinha para o lead não se perder. Publicidade e
 * dúvida avulsa não chegam a esse passo do robô.
 */
export function botDataShowsTherapyIntent(collected: unknown): boolean {
  if (!collected || typeof collected !== "object" || Array.isArray(collected)) return false;
  const data = collected as Record<string, unknown>;
  return ["child_name", "child_birth_date", "card_number"].some(
    (key) => typeof data[key] === "string" && (data[key] as string).trim() !== "",
  );
}
