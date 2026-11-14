// lib/patient-pills-pure.ts
//
// Pílulas de pendência ao lado do nome do paciente (lista de Pacientes da
// recepção). Substitui o menu Pendências: o que faltava lá agora aparece junto
// do paciente. Lógica pura (sem imports "@/") para rodar em node:test
// (tests/patient-pills-pure.test.ts).

/** urgent = precisa de ação hoje; missing = falta documento/dado; progress = já em andamento (aguardando plano/remarcação). */
export type PillTone = "urgent" | "missing" | "progress";

export type PatientPill = {
  key: string;
  label: string;
  tone: PillTone;
  /** Texto longo para o `title` e para o diálogo ("Falta o RG/CNH do responsável"). */
  detail: string;
};

const TONE_RANK: Record<PillTone, number> = { urgent: 0, missing: 1, progress: 2 };

/** Categorias da fila da recepção que viram pílula (as que têm paciente e são da recepção). */
const QUEUE_CATEGORY_PILL: Record<string, { label: string; tone: PillTone; detail: string }> = {
  falta_sem_motivo: { label: "Falta s/ motivo", tone: "urgent", detail: "Falta registrada sem motivo: falar com a família" },
  guia_vencendo: { label: "Guia vencendo", tone: "urgent", detail: "A guia autorizada está perto de vencer" },
  guia_poucas_sessoes: { label: "Guia: poucas sessões", tone: "urgent", detail: "A guia está com poucas sessões restantes" },
  documento_vencido: { label: "Doc vencido", tone: "urgent", detail: "Há documento do paciente vencido" },
  remarcacao_solicitada: { label: "Remarcar", tone: "progress", detail: "A família pediu remarcação" },
  renovacao_solicitada: { label: "Renovar guia", tone: "progress", detail: "Renovação de guia solicitada, aguardando o plano" },
};

/** Categorias da fila que têm painel de ação dentro do diálogo do paciente. */
export const PANEL_CATEGORIES: readonly string[] = [...Object.keys(QUEUE_CATEGORY_PILL), "cadastro_assistido_ia"];

export function pillForQueueCategory(category: string): PatientPill | null {
  const base = QUEUE_CATEGORY_PILL[category];
  return base ? { key: category, ...base } : null;
}

// ----- Cadastro: RG/CNH, laudo, carteirinha, e-mail

const CADASTRO_PILLS = {
  rg: { key: "rg", label: "RG/CNH", tone: "missing", detail: "Falta o RG ou CNH do responsável" },
  laudo: { key: "laudo", label: "Laudo", tone: "missing", detail: "Falta o laudo médico (ou pedido médico)" },
  carteirinha: { key: "carteirinha", label: "Carteirinha", tone: "missing", detail: "Falta a carteirinha do plano" },
  email: { key: "email", label: "E-mail", tone: "missing", detail: "Falta o e-mail do responsável" },
} as const satisfies Record<string, PatientPill>;

export type RegistrationInput = {
  /** Categorias de `documents` do paciente. */
  docCategories: string[];
  /** E-mails dos responsáveis (vazios já descartados ou não). */
  guardianEmails: (string | null | undefined)[];
  /** Linhas de `patient_insurance`: `true` = particular. Vazio = convênio desconhecido. */
  insurancePrivateFlags: boolean[];
};

/**
 * Pendências de cadastro de um paciente SEM contato pendente do WhatsApp.
 * Particular não precisa de laudo nem carteirinha; sem convênio cadastrado não
 * dá para saber, então esses dois não são cobrados.
 */
export function registrationPills(input: RegistrationInput): PatientPill[] {
  const has = (...cats: string[]) => input.docCategories.some((c) => cats.includes(c));
  const pills: PatientPill[] = [];

  if (!has("documento_identidade", "documento_responsavel")) pills.push(CADASTRO_PILLS.rg);

  const hasPlan = input.insurancePrivateFlags.some((isPrivate) => !isPrivate);
  if (hasPlan) {
    // Laudo OU pedido médico resolve a pendência médica (mesma regra de lib/lead-pendencies.ts).
    if (!has("laudo", "pedido_medico")) pills.push(CADASTRO_PILLS.laudo);
    if (!has("carteirinha")) pills.push(CADASTRO_PILLS.carteirinha);
  }

  if (!input.guardianEmails.some((e) => typeof e === "string" && e.trim() !== "")) pills.push(CADASTRO_PILLS.email);
  return pills;
}

/** Chaves das pílulas de `lib/lead-pendencies.ts` que valem como pílula de cadastro. */
const LEAD_KEY_TO_PILL: Record<string, keyof typeof CADASTRO_PILLS> = {
  doc_responsavel: "rg",
  laudo: "laudo",
  carteirinha: "carteirinha",
  email: "email",
};

/** Paciente COM contato pendente: vale o motor do lead (considera arquivos ainda não anexados). */
export function pillsFromLeadPendencies(leadPills: { key: string; state: string }[]): PatientPill[] {
  const out: PatientPill[] = [];
  for (const p of leadPills) {
    const target = LEAD_KEY_TO_PILL[p.key];
    if (target && p.state === "faltando") out.push(CADASTRO_PILLS[target]);
  }
  return out;
}

/** Junta, tira repetidas e ordena: urgente → falta → em andamento. */
export function mergePills(...groups: PatientPill[][]): PatientPill[] {
  const seen = new Set<string>();
  const merged: PatientPill[] = [];
  for (const pill of groups.flat()) {
    if (seen.has(pill.key)) continue;
    seen.add(pill.key);
    merged.push(pill);
  }
  return merged
    .map((pill, index) => ({ pill, index }))
    .sort((a, b) => TONE_RANK[a.pill.tone] - TONE_RANK[b.pill.tone] || a.index - b.index)
    .map(({ pill }) => pill);
}

/**
 * Pílulas visíveis na linha do paciente: as mais urgentes primeiro (a lista já vem
 * ordenada por urgência) e um "+N" para o resto, para a linha não virar mural
 * (regra 5 do AGENTS.md: informação progressiva). O diálogo mostra todas.
 */
export function visiblePills(pills: PatientPill[], max = 2): { shown: PatientPill[]; extra: number } {
  const limit = Math.max(1, max);
  return { shown: pills.slice(0, limit), extra: Math.max(0, pills.length - limit) };
}
