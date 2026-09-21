// lib/lead-pendencies.ts
//
// Motor único do "o que falta" de um contato do WhatsApp na fila de Pendências
// da recepção. Lógica pura (sem imports "@/") para ser testável com node:test
// (tests/lead-pendencies.test.ts).
//
// Junta três fontes que antes ficavam soltas:
//   1. o que o responsável DIGITOU no bot de agendamento (`bot_collected`);
//   2. o que a IA LEU nos arquivos (`extracted`, formato DocumentExtraction);
//   3. os arquivos em si (`detected_type` dos arquivos do rascunho + `category`
//      dos documentos do paciente-lead — depois de uma cobrança, a mídia de um
//      telefone já conhecido vai para `documents`, não para o rascunho).
// Resposta digitada vence a leitura da IA (OCR erra; quem digitou sabe).

export type PillState = "ok" | "faltando" | "aviso" | "nao_se_aplica" | "analisando";
export type PillGroup = "dado" | "documento";

/** Chaves de `MISSING_DOCUMENT_TEMPLATES` (lib/document-request-templates.ts) — literais porque aquele módulo importa "@/". */
export type ChaseKey = "laudo_medico" | "pedido_medico" | "carteirinha" | "documento_responsavel";

export type LeadPill = {
  key: string;
  label: string;
  group: PillGroup;
  state: PillState;
  /** Complemento curto para o `title`/leitor de tela ("opcional no particular", "família disse que não tem"). */
  detail?: string;
  /** Modelo de cobrança do documento, quando faz sentido cobrar da família. */
  chaseKey?: ChaseKey;
};

export type LeadPendenciesInput = {
  /** `registration_drafts.extracted` (DocumentExtraction), sem confiar no formato. */
  extracted: unknown;
  /** `registration_drafts.bot_collected`, sem confiar no formato. */
  bot: unknown;
  /** `registration_draft_files.detected_type` de cada arquivo do rascunho. */
  fileTypes: (string | null)[];
  /** `documents.category` do paciente-lead (mídia que entrou depois, fora do rascunho). */
  patientDocCategories: string[];
  /** Existe convênio identificado (patient_insurance, conversa ou leitura da IA). */
  insurerKnown: boolean;
  /** `registration_drafts.authorization_waived`. */
  authorizationWaived: boolean;
  planAuthorizedAt: string | null;
  hasAuthorizedGuide: boolean;
  draftStatus: string;
  filesCount: number;
};

export type LeadPendencies = {
  /** Faltando → aviso → analisando → ok → não se aplica; dentro de cada estado, documentos antes de dados. */
  pills: LeadPill[];
  /** Só `faltando` — aviso, "analisando" e "não se aplica" não contam. */
  missingCount: number;
  summary: string;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

// ---------------------------------------------------------------------
// Dados digitados no bot
// ---------------------------------------------------------------------

/** Chaves de `chatbot_sessions.collected_data` que valem como "o lead deu um dado". */
const BOT_DATUM_KEYS = [
  "guardian_name",
  "guardian_cpf",
  "guardian_email",
  "child_name",
  "child_birth_date",
  "card_number",
  "laudo_pdf_url",
  "guia_pdf_url",
  "carteirinha_frente_url",
  "carteirinha_verso_url",
] as const;

/**
 * O lead já informou alguma coisa? `started_at` sozinho (só disse "agendar")
 * não conta — e "é particular/convênio" sozinho também não: sem nenhum dado
 * ou documento não há o que a recepção conferir. Quem só perguntou no FAQ
 * nunca chega aqui (não tem sessão do bot).
 */
export function isBotDatumPresent(collected: unknown): boolean {
  const data = asRecord(collected);
  if (!data) return false;
  return BOT_DATUM_KEYS.some((key) => asText(data[key]) !== null);
}

/**
 * Recorte de `collected_data` que interessa à recepção (sem `available_slots`,
 * sem controle interno de "perguntei o e-mail de novo"). E-mail vazio é
 * guardado como `""` — o lead recusou duas vezes.
 */
export function pickBotCollected(collected: unknown, step: string | null): Record<string, unknown> {
  const data = asRecord(collected) ?? {};
  const picked: Record<string, unknown> = {};
  for (const key of BOT_DATUM_KEYS) {
    const value = data[key];
    if (typeof value === "string" && (value.trim() !== "" || key === "guardian_email")) picked[key] = value;
  }
  if (typeof data.is_private === "boolean") picked.is_private = data.is_private;
  if (typeof data.has_laudo === "boolean") picked.has_laudo = data.has_laudo;
  if (typeof data.request_id === "string") picked.request_id = data.request_id;
  if (typeof data.lead_patient_id === "string") picked.lead_patient_id = data.lead_patient_id;
  if (step) picked.last_step = step;
  return picked;
}

/**
 * Coloca o que o responsável digitou no formato de `DocumentExtraction`, para
 * `draftFacts`, o formulário de validação e `promoteDraftToLead` lerem tudo de
 * um lugar só sem mudar. Digitado vence a IA; vazio nunca apaga a leitura.
 */
export function mergeBotCollectedIntoExtraction(extracted: unknown, bot: unknown): Record<string, unknown> {
  const base = asRecord(extracted) ?? {};
  const data = asRecord(bot);
  if (!data) return { ...base };

  const patient = { ...(asRecord(base.patient) ?? {}) };
  const guardian = { ...(asRecord(base.guardian) ?? {}) };
  const insurance = { ...(asRecord(base.insurance) ?? {}) };

  const childName = asText(data.child_name);
  if (childName) patient.full_name = childName;
  const birthDate = asText(data.child_birth_date);
  if (birthDate) patient.birth_date = birthDate;
  const guardianName = asText(data.guardian_name);
  if (guardianName) guardian.full_name = guardianName;
  const guardianCpf = asText(data.guardian_cpf);
  if (guardianCpf) guardian.cpf = guardianCpf;
  const guardianEmail = asText(data.guardian_email);
  if (guardianEmail) guardian.email = guardianEmail;
  const cardNumber = asText(data.card_number);
  if (cardNumber) insurance.card_number = cardNumber;

  return { ...base, patient, guardian, insurance };
}

// ---------------------------------------------------------------------
// Pílulas
// ---------------------------------------------------------------------

const STATE_RANK: Record<PillState, number> = { faltando: 0, aviso: 1, analisando: 2, ok: 3, nao_se_aplica: 4 };

const hasAny = (haystack: Set<string>, ...needles: string[]) => needles.some((n) => haystack.has(n));

export function computeLeadPendencies(input: LeadPendenciesInput): LeadPendencies {
  const bot = asRecord(input.bot);
  const extracted = asRecord(input.extracted);
  const patient = asRecord(extracted?.patient);
  const guardian = asRecord(extracted?.guardian);
  const insurance = asRecord(extracted?.insurance);

  // Particular = convênio sem guia. O que o responsável respondeu no bot manda;
  // sem resposta (mídia solta, portal), vale o "sem guia" marcado pela recepção.
  const isPrivate = bot?.is_private === true || (bot?.is_private == null && input.authorizationWaived);

  const types = new Set<string>();
  for (const t of input.fileTypes) if (t) types.add(t);
  for (const c of input.patientDocCategories) if (c) types.add(c);

  const readingPending =
    (input.draftStatus === "pending" || input.draftStatus === "processing") && input.filesCount > 0;

  // ----- Dados (mesmas regras de computeCompleteness em whatsapp-leads-view.ts)
  const childName = asText(bot?.child_name) ?? asText(patient?.full_name);
  const birthDate = asText(bot?.child_birth_date) ?? asText(patient?.birth_date);
  const guardianName = asText(bot?.guardian_name) ?? asText(guardian?.full_name);
  const guardianCpf = asText(bot?.guardian_cpf) ?? asText(guardian?.cpf);
  const guardianEmail = asText(bot?.guardian_email) ?? asText(guardian?.email);
  const cardNumber = asText(bot?.card_number) ?? asText(insurance?.card_number);
  const hasInsurance = input.insurerKnown || asText(insurance?.insurer_name) !== null;

  const dado = (key: string, label: string, value: string | null, extra?: Partial<LeadPill>): LeadPill => ({
    key,
    label,
    group: "dado",
    state: value ? "ok" : "faltando",
    ...extra,
  });

  const pills: LeadPill[] = [];

  // ----- Documentos
  const doc = (
    key: string,
    label: string,
    present: boolean,
    chaseKey: ChaseKey | undefined,
    extra?: Partial<LeadPill>,
  ): LeadPill => ({
    key,
    label,
    group: "documento",
    state: present ? "ok" : readingPending ? "analisando" : "faltando",
    chaseKey,
    ...extra,
  });

  const hasLaudo = asText(bot?.laudo_pdf_url) !== null || hasAny(types, "laudo");
  const hasPedido = hasAny(types, "pedido_medico");
  const hasCarteirinha = asText(bot?.carteirinha_frente_url) !== null || hasAny(types, "carteirinha");
  // `documento_identidade` pode ser o RG da CRIANÇA (a IA não distingue de quem é);
  // aceitamos como "recebido" e a recepção confere no cartão do contato.
  const hasResponsibleDoc = hasAny(types, "documento_identidade", "documento_responsavel");
  const hasGuia =
    asText(bot?.guia_pdf_url) !== null || hasAny(types, "autorizacao") || Boolean(input.planAuthorizedAt) || input.hasAuthorizedGuide;

  const optional = (label: string, key: string, present: boolean, chaseKey: ChaseKey): LeadPill => ({
    key,
    label,
    group: "documento",
    state: present ? "ok" : "aviso",
    detail: present ? undefined : "opcional no atendimento particular",
    chaseKey,
  });

  pills.push(
    isPrivate
      ? optional("Laudo", "laudo", hasLaudo, "laudo_medico")
      : doc("laudo", "Laudo", hasLaudo, "laudo_medico", {
          detail: !hasLaudo && bot?.has_laudo === false ? "a família disse que ainda não tem" : undefined,
        }),
  );

  if (isPrivate) {
    pills.push({ key: "carteirinha", label: "Carteirinha", group: "documento", state: "nao_se_aplica", detail: "atendimento particular" });
    pills.push({ key: "guia", label: "Guia", group: "documento", state: "nao_se_aplica", detail: "atendimento particular" });
  } else {
    pills.push(doc("carteirinha", "Carteirinha", hasCarteirinha, "carteirinha"));
    pills.push(
      input.authorizationWaived && !hasGuia
        ? { key: "guia", label: "Guia", group: "documento", state: "nao_se_aplica", detail: "dispensada pela recepção" }
        : {
            key: "guia",
            label: hasGuia ? "Guia" : "Guia: clínica autoriza",
            group: "documento",
            state: hasGuia ? "ok" : "aviso",
            detail: hasGuia ? undefined : "a guia é opcional — a clínica pede a autorização ao plano (etapa 2)",
          },
    );
  }

  pills.push(doc("doc_responsavel", "RG do responsável", hasResponsibleDoc, "documento_responsavel"));
  pills.push(
    isPrivate ? optional("Pedido médico", "pedido_medico", hasPedido, "pedido_medico") : doc("pedido_medico", "Pedido médico", hasPedido, "pedido_medico"),
  );

  // ----- Dados
  pills.push(dado("crianca", "Criança", childName));
  pills.push(dado("nascimento", "Nascimento", birthDate));
  pills.push(dado("responsavel", "Responsável", guardianName));
  pills.push(dado("cpf", "CPF", guardianCpf));
  pills.push(dado("email", "E-mail", guardianEmail));
  if (isPrivate) {
    pills.push({ key: "convenio_cartao", label: "Convênio/cartão", group: "dado", state: "nao_se_aplica", detail: "atendimento particular" });
  } else {
    const okInsurance = hasInsurance && cardNumber !== null;
    pills.push({
      key: "convenio_cartao",
      label: "Convênio/cartão",
      group: "dado",
      state: okInsurance ? "ok" : "faltando",
      detail: okInsurance ? undefined : cardNumber ? "informar o plano de saúde" : hasInsurance ? "informar o nº da carteirinha" : undefined,
    });
  }

  const ordered = pills
    .map((pill, index) => ({ pill, index }))
    .sort((a, b) => STATE_RANK[a.pill.state] - STATE_RANK[b.pill.state] || a.index - b.index)
    .map(({ pill }) => pill);

  const missing = ordered.filter((p) => p.state === "faltando");
  return {
    pills: ordered,
    missingCount: missing.length,
    summary: missing.length === 0 ? "Dados e documentos completos" : `Faltam ${missing.length}: ${missing.map((p) => p.label).join(", ")}`,
  };
}

/** Só as pílulas que aparecem na linha recolhida (sem "não se aplica"). */
export function visiblePills(result: LeadPendencies): LeadPill[] {
  return result.pills.filter((p) => p.state !== "nao_se_aplica");
}

/** Chaves de cobrança dos documentos que de fato faltam (estado `faltando`), sem repetir. */
export function missingChaseKeys(result: LeadPendencies): ChaseKey[] {
  const keys: ChaseKey[] = [];
  for (const pill of result.pills) {
    if (pill.state === "faltando" && pill.chaseKey && !keys.includes(pill.chaseKey)) keys.push(pill.chaseKey);
  }
  return keys;
}
