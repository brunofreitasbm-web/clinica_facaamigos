// lib/draft-adjust-pure.ts
// Regras puras do "Ajustar cadastro" (app/recepcao/pacientes/pendencias/draft-adjust-actions.ts). Sem I/O.

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * `bot_collected` (o que a família digitou no bot) GANHA de `extracted` em computeLeadPendencies e é
 * recolocado por cima de `extracted` a cada mensagem do bot e a cada reprocessamento
 * (mergeBotCollectedIntoExtraction). Corrigir só `extracted` deixa a correção invisível nas pendências e
 * a desfaz depois. Por isso a correção também vai para as chaves que o bot já guardou (nunca cria chave nova,
 * para não mexer no andamento do fluxo do bot). Devolve null quando não há nada a mudar.
 */
export function applyAdjustmentToBotCollected(
  bot: unknown,
  values: {
    childName: string;
    birthDate: string;
    guardianName: string;
    guardianCpf: string | null;
    guardianEmail: string;
    cardNumber: string;
  },
): Record<string, unknown> | null {
  const current = asRecord(bot);
  const wanted: Record<string, string> = {
    child_name: values.childName,
    child_birth_date: values.birthDate,
    guardian_name: values.guardianName,
    guardian_cpf: values.guardianCpf ?? "",
    guardian_email: values.guardianEmail,
    card_number: values.cardNumber,
  };
  const next = { ...current };
  let changed = false;
  for (const [key, value] of Object.entries(wanted)) {
    const existing = current[key];
    if (typeof existing !== "string") continue;
    if (existing !== value) {
      next[key] = value;
      changed = true;
    }
  }
  return changed ? next : null;
}
