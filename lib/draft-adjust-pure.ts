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

// ---------------------------------------------------------------------------
// Correções manuais que sobrevivem à releitura dos documentos.
//
// Quando a família manda um arquivo novo, o `extracted` é zerado e a IA lê tudo de novo
// (lib/registration-drafts-ingest.ts, lib/registration-drafts-process.ts). O que o operador corrigiu em
// "Ajustar cadastro" some junto. As correções ficam, então, numa coluna própria (`manual_overrides`, que nada
// disso apaga) e são reaplicadas por cima da leitura nova.
// ---------------------------------------------------------------------------

export type OverrideGroup = "patient" | "guardian" | "insurance";
export type ManualOverrides = Partial<Record<OverrideGroup, Record<string, string | null>>>;

/** Campos de cada grupo que o operador pode corrigir (mesmas chaves de `extracted`). */
const OVERRIDE_KEYS: Record<OverrideGroup, string[]> = {
  patient: ["full_name", "birth_date", "cpf", "cid", "complaint_hint"],
  guardian: ["full_name", "phone", "cpf", "email"],
  insurance: ["card_number"],
};

/** Campos que o formulário não consegue limpar (vazio significa "não mexi"): só viram correção se tiverem valor. */
const NEVER_CLEARED = new Set(["guardian.phone", "patient.complaint_hint"]);

function textOf(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function readOverrides(raw: unknown): ManualOverrides {
  const out: ManualOverrides = {};
  const root = asRecord(raw);
  for (const group of Object.keys(OVERRIDE_KEYS) as OverrideGroup[]) {
    const block = asRecord(root[group]);
    const kept: Record<string, string | null> = {};
    for (const key of OVERRIDE_KEYS[group]) {
      const v = block[key];
      if (typeof v === "string" || v === null) kept[key] = v;
    }
    if (Object.keys(kept).length > 0) out[group] = kept;
  }
  return out;
}

/**
 * Correções a guardar depois de um "Salvar ajustes": só o que o operador MUDOU em relação ao que o rascunho
 * tinha (`currentExtracted`). Campo vazio que continua vazio não vira correção, senão bloquearia a IA de ler esse
 * dado quando um documento novo chegar. Apagar um valor errado (campo vazio onde havia valor) vira correção com
 * `null`. Parte das correções anteriores: uma correção nova do mesmo campo vence a antiga.
 */
export function computeManualOverrides(
  currentExtracted: unknown,
  next: Record<OverrideGroup, Record<string, string>>,
  previous: unknown,
): ManualOverrides {
  const current = asRecord(currentExtracted);
  const merged = readOverrides(previous);
  for (const group of Object.keys(OVERRIDE_KEYS) as OverrideGroup[]) {
    const currentBlock = asRecord(current[group]);
    for (const key of OVERRIDE_KEYS[group]) {
      if (!(key in next[group])) continue;
      const wanted = textOf(next[group][key]);
      if (wanted === textOf(currentBlock[key])) continue;
      if (wanted === "" && NEVER_CLEARED.has(`${group}.${key}`)) continue;
      merged[group] = { ...(merged[group] ?? {}), [key]: wanted === "" ? null : wanted };
    }
  }
  return merged;
}

/** Reaplica as correções do operador por cima de uma leitura nova (a correção sempre vence a IA e o bot). */
export function applyManualOverrides(extracted: unknown, overrides: unknown): Record<string, unknown> {
  const base = asRecord(extracted);
  const fixes = readOverrides(overrides);
  if (Object.keys(fixes).length === 0) return { ...base };
  const result: Record<string, unknown> = { ...base };
  for (const group of Object.keys(fixes) as OverrideGroup[]) {
    result[group] = { ...asRecord(base[group]), ...fixes[group] };
  }
  return result;
}
