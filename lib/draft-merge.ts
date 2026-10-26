// lib/draft-merge.ts
//
// Identifica e mescla rascunhos de cadastramento ("cadastro_assistido_ia")
// que pertencem ao mesmo paciente e responsável, mesmo quando enviados por
// diferentes conversas do WhatsApp ou números de telefone distintos.
//
// Regras de negócio:
// - Compara: Nome do responsável, Nome do paciente, dados (CPF, nascimento, carteirinha)
//   e eventualmente telefone.
// - Irmãos/gêmeos (mesmo telefone ou responsável, mas nomes de criança conflitantes)
//   NUNCA são mesclados.
// - Ao mesclar: une arquivos recebidos, dados extraídos, mensagens de conversa,
//   observações e recalcula pendências unificadas.

import { computeLeadPendencies, type LeadPendencies } from "./lead-pendencies.ts";

export type PendingDraftFile = {
  id: string;
  name: string;
  mimeType: string;
  detectedType: string | null;
};

export type PendingDraftFact = { label: string; value: string };

export type PendingDraftMessage = {
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string;
  hasMedia: boolean;
};

export type PendingDraftDocumentRequest = {
  key: any;
  sentAt: string;
};

export type DraftAuthorizedGuide = {
  guide_number: string | null;
  procedure_code: string | null;
  sessions_authorized: number | null;
  valid_from: string | null;
  valid_to: string | null;
  authorization_password: string | null;
  password_valid_until: string | null;
  procedures: { code: string; description: string; quantity: number }[];
};

export type DraftPipeline = {
  authorization: "pendente" | "enviada" | "autorizada" | "dispensada";
  guideSentAt: string | null;
  guideSentByName: string | null;
  authorizedAt: string | null;
  authorizedByName: string | null;
  authorizedGuide: DraftAuthorizedGuide | null;
  authorizationId: string | null;
  schedulingEnabledAt: string | null;
  suggestedGuide: DraftAuthorizedGuide | null;
  registered: boolean;
};

export type PendingRegistrationDraft = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  sourcePhone: string | null;
  source: "whatsapp" | "portal";
  status: "pending" | "processing" | "extracted" | "failed" | "validated";
  pipeline: DraftPipeline;
  createdAt: string;
  guardianMessage: string | null;
  files: PendingDraftFile[];
  facts: PendingDraftFact[];
  warnings: string[];
  error: string | null;
  messages: PendingDraftMessage[];
  documentRequests: PendingDraftDocumentRequest[];
  pendencies: LeadPendencies;
  mergedDraftsCount?: number;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Normaliza nomes removendo acentos, pontuações e espaços extras. */
export function normalizeName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Verifica se dois nomes são equivalentes ou se um é extensão/abreviação do outro. */
export function areNamesMatching(nameA?: string | null, nameB?: string | null): boolean {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Se um nome contém o outro e tem tamanho expressivo
  if ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 6) {
    return true;
  }

  // Sobreposição de tokens (ex.: "Arthur Miguel da Silva" e "Arthur Miguel Silva")
  const tokensA = a.split(" ").filter((t) => t.length > 2);
  const tokensB = b.split(" ").filter((t) => t.length > 2);
  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const intersection = tokensA.filter((t) => tokensB.includes(t));
    if (
      intersection.length >= 2 &&
      (intersection.length >= tokensA.length - 1 || intersection.length >= tokensB.length - 1)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Detecta se dois nomes são explicitamente conflitantes (ex.: "João Silva" vs "Pedro Silva").
 * Impede que irmãos no mesmo WhatsApp sejam equivocadamente mesclados.
 */
export function areNamesConflicting(nameA?: string | null, nameB?: string | null): boolean {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (!a || !b) return false;
  if (areNamesMatching(a, b)) return false;

  const firstA = a.split(" ")[0];
  const firstB = b.split(" ")[0];
  if (firstA && firstB && firstA !== firstB) {
    return true;
  }

  return false;
}

/** Normaliza dígitos de telefone pegando os últimos 8 ou 9 dígitos úteis. */
export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

export function arePhonesMatching(phoneA?: string | null, phoneB?: string | null): boolean {
  const pA = normalizePhoneDigits(phoneA);
  const pB = normalizePhoneDigits(phoneB);
  if (!pA || !pB) return false;
  return pA === pB;
}

export function normalizeCpfDigits(cpf?: string | null): string {
  if (!cpf) return "";
  const digits = cpf.replace(/\D/g, "");
  return digits.length === 11 ? digits : "";
}

export type DraftIdentity = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  patientBirthDate: string | null;
  patientCpf: string | null;
  guardianName: string | null;
  guardianCpf: string | null;
  guardianPhone: string | null;
  sourcePhone: string | null;
  cardNumber: string | null;
};

/**
 * Extrai os dados essenciais de identificação de um rascunho a partir
 * de seus campos, do JSON extraído pela IA e dos dados digitados no bot.
 */
export function extractDraftIdentity(draft: PendingRegistrationDraft, botCollected?: unknown): DraftIdentity {
  const ext = asRecord(draft.facts) ? null : asRecord((draft as unknown as { extracted?: unknown }).extracted);
  const pat = asRecord(ext?.patient);
  const grd = asRecord(ext?.guardian);
  const ins = asRecord(ext?.insurance);
  const bot = asRecord(botCollected);

  // Nome do paciente: prioriza o que já estiver resolvido, depois extração, depois bot
  const factPatientName = draft.facts.find((f) => f.label === "Criança")?.value;
  const patientName = draft.patientName ?? asText(pat?.full_name) ?? asText(bot?.child_name) ?? factPatientName ?? null;

  const factBirthDate = draft.facts.find((f) => f.label === "Nascimento")?.value;
  const patientBirthDate = asText(pat?.birth_date) ?? asText(bot?.child_birth_date) ?? factBirthDate ?? null;

  const factPatientCpf = draft.facts.find((f) => f.label === "CPF da criança")?.value;
  const patientCpf = normalizeCpfDigits(asText(pat?.cpf) ?? factPatientCpf);

  const factGuardianName = draft.facts.find((f) => f.label === "Responsável")?.value;
  const guardianName = asText(grd?.full_name) ?? asText(bot?.guardian_name) ?? factGuardianName ?? null;

  const factGuardianCpf = draft.facts.find((f) => f.label === "CPF do responsável")?.value;
  const guardianCpf = normalizeCpfDigits(asText(grd?.cpf) ?? asText(bot?.guardian_cpf) ?? factGuardianCpf);

  const factPhone = draft.facts.find((f) => f.label === "Telefone")?.value;
  const guardianPhone = asText(grd?.phone) ?? asText(bot?.guardian_phone) ?? factPhone ?? null;

  const factCard = draft.facts.find((f) => f.label === "Carteirinha")?.value;
  const cardNumber = asText(ins?.card_number) ?? asText(bot?.card_number) ?? factCard ?? null;

  return {
    id: draft.id,
    patientId: draft.patientId,
    patientName,
    patientBirthDate,
    patientCpf,
    guardianName,
    guardianCpf,
    guardianPhone,
    sourcePhone: draft.sourcePhone,
    cardNumber,
  };
}

/**
 * Compara dois rascunhos para determinar se tratam da mesma criança/caso.
 */
export function areDraftsSameCase(a: DraftIdentity, b: DraftIdentity): boolean {
  if (a.id === b.id) return false;

  // Bloqueios de conflito estrito (evita mesclar irmãos ou pacientes diferentes)
  if (areNamesConflicting(a.patientName, b.patientName)) return false;
  if (a.patientCpf && b.patientCpf && a.patientCpf !== b.patientCpf) return false;
  if (a.patientBirthDate && b.patientBirthDate && a.patientBirthDate !== b.patientBirthDate) return false;
  if (areNamesConflicting(a.guardianName, b.guardianName)) return false;
  if (a.guardianCpf && b.guardianCpf && a.guardianCpf !== b.guardianCpf) return false;

  // 1. Mesmo vínculo de paciente
  if (a.patientId && b.patientId && a.patientId === b.patientId) return true;

  // 2. Mesmo CPF da criança
  if (a.patientCpf && b.patientCpf && a.patientCpf === b.patientCpf) return true;

  const childMatch = areNamesMatching(a.patientName, b.patientName);
  const guardianMatch = areNamesMatching(a.guardianName, b.guardianName);
  const guardianCpfMatch = Boolean(a.guardianCpf && b.guardianCpf && a.guardianCpf === b.guardianCpf);

  const phoneMatch =
    arePhonesMatching(a.sourcePhone, b.sourcePhone) ||
    arePhonesMatching(a.sourcePhone, b.guardianPhone) ||
    arePhonesMatching(a.guardianPhone, b.sourcePhone) ||
    arePhonesMatching(a.guardianPhone, b.guardianPhone);

  const birthMatch = Boolean(a.patientBirthDate && b.patientBirthDate && a.patientBirthDate === b.patientBirthDate);
  const cardMatch = Boolean(a.cardNumber && b.cardNumber && a.cardNumber === b.cardNumber);

  // 3. CPF do responsável confere e há indício da mesma criança
  if (guardianCpfMatch && (childMatch || birthMatch || phoneMatch || (!a.patientName && !b.patientName))) {
    return true;
  }

  // 4. Nome da criança E nome do responsável batem (mesmo que com telefones diferentes)
  if (childMatch && (guardianMatch || guardianCpfMatch)) return true;

  // 5. Nome da criança bate E mesmo telefone (eventualmente o mesmo número de telefone)
  if (childMatch && phoneMatch) return true;

  // 6. Nome da criança bate E data de nascimento ou carteirinha bate
  if (childMatch && (birthMatch || cardMatch)) return true;

  // 7. Nome do responsável bate E telefone bate E (mesmo nascimento, mesma carteirinha ou nenhum conflito)
  if (guardianMatch && phoneMatch) {
    if (birthMatch || cardMatch || (a.patientName && b.patientName && childMatch)) return true;
    // Se um tem nome da criança e o outro ainda não tinha o nome lido
    if ((a.patientName && !b.patientName) || (!a.patientName && b.patientName)) return true;
  }

  // 8. Mesma carteirinha de convênio E (telefone ou responsável confere)
  if (cardMatch && (phoneMatch || guardianMatch || childMatch)) return true;

  // 9. Só o nome da criança bate (telefones diferentes, responsável ausente, sem
  //    nascimento/CPF para confirmar). Os conflitos duros já foram barrados acima.
  if (childMatch && isNameOnlyMatchTrusted(a.patientName, b.patientName)) return true;

  return false;
}

/**
 * Decide se o nome da criança, SOZINHO, basta para tratar dois rascunhos como o
 * mesmo paciente. Caso real: o responsável manda várias conversas (números
 * diferentes) citando a criança pelo mesmo nome e nada mais foi extraído.
 * Falso positivo junta dois pacientes (homônimos); falso negativo deixa
 * cadastros duplicados na fila.
 */
export function isNameOnlyMatchTrusted(nameA?: string | null, nameB?: string | null): boolean {
  // Política conservadora: nome idêntico após normalização e ao menos 3 palavras.
  // "Arthur" ou "João Silva" sozinhos nunca bastam; nome apenas "contido" também não.
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  return a !== "" && a === b && a.split(" ").length >= 3;
}

/**
 * Agrupa rascunhos que pertencem ao mesmo paciente/caso.
 */
export function groupMatchingDrafts(
  drafts: PendingRegistrationDraft[],
  botByDraft: Map<string, unknown>,
): PendingRegistrationDraft[][] {
  if (drafts.length <= 1) return drafts.map((d) => [d]);

  const identities = drafts.map((d) => extractDraftIdentity(d, botByDraft.get(d.id)));
  const n = drafts.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }

  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (areDraftsSameCase(identities[i], identities[j])) {
        union(i, j);
      }
    }
  }

  const groupsByRoot = new Map<number, PendingRegistrationDraft[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groupsByRoot.get(root) ?? [];
    list.push(drafts[i]);
    groupsByRoot.set(root, list);
  }

  return Array.from(groupsByRoot.values());
}

/** Escolhe o rascunho principal do grupo (mais avançado / mais antigo). */
export function pickPrimaryDraft(group: PendingRegistrationDraft[]): PendingRegistrationDraft {
  return group.slice().sort((a, b) => {
    // 1. Já vinculado a paciente existente
    if (Boolean(a.patientId) !== Boolean(b.patientId)) return a.patientId ? -1 : 1;

    // 2. Status de validação
    const statusPriority: Record<string, number> = {
      validated: 5,
      extracted: 4,
      processing: 3,
      pending: 2,
      failed: 1,
    };
    const pA = statusPriority[a.status] ?? 0;
    const pB = statusPriority[b.status] ?? 0;
    if (pA !== pB) return pB - pA;

    // 3. Quantidade de arquivos + fatos conhecidos
    const countA = a.files.length + a.facts.length;
    const countB = b.files.length + b.facts.length;
    if (countA !== countB) return countB - countA;

    // 4. Mais antigo primeiro
    return a.createdAt.localeCompare(b.createdAt);
  })[0];
}

/** Mescla profundamente os dados extraídos pelo Gemini sem perder informações. */
export function mergeExtractedData(base: unknown, extra: unknown): Record<string, unknown> {
  const b = (base && typeof base === "object" && !Array.isArray(base) ? base : {}) as Record<string, unknown>;
  const e = (extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {}) as Record<string, unknown>;

  const mergeBlock = (blockName: string): Record<string, unknown> => {
    const bb = (b[blockName] && typeof b[blockName] === "object" ? b[blockName] : {}) as Record<string, unknown>;
    const eb = (e[blockName] && typeof e[blockName] === "object" ? e[blockName] : {}) as Record<string, unknown>;
    const res: Record<string, unknown> = { ...bb };
    for (const [k, v] of Object.entries(eb)) {
      if (v !== null && v !== undefined && v !== "") {
        if (res[k] === null || res[k] === undefined || res[k] === "") {
          res[k] = v;
        } else if (
          typeof v === "string" &&
          typeof res[k] === "string" &&
          (v as string).length > (res[k] as string).length
        ) {
          res[k] = v;
        }
      }
    }
    return res;
  };

  const patient = mergeBlock("patient");
  const guardian = mergeBlock("guardian");
  const address = mergeBlock("address");
  const insurance = mergeBlock("insurance");
  const authorization = mergeBlock("authorization");

  const docsB = Array.isArray(b.documents) ? b.documents : [];
  const docsE = Array.isArray(e.documents) ? e.documents : [];
  const seenDocs = new Set<string>();
  const documents: unknown[] = [];
  for (const doc of [...docsB, ...docsE]) {
    if (doc && typeof doc === "object") {
      const rec = doc as Record<string, unknown>;
      const key = `${rec.kind}_${rec.summary}`;
      if (!seenDocs.has(key)) {
        seenDocs.add(key);
        documents.push(doc);
      }
    }
  }

  const warningsB = Array.isArray(b.warnings) ? (b.warnings as string[]) : [];
  const warningsE = Array.isArray(e.warnings) ? (e.warnings as string[]) : [];
  const warnings = [...new Set([...warningsB, ...warningsE])];

  return {
    ...b,
    ...e,
    patient,
    guardian,
    address,
    insurance,
    authorization,
    documents,
    warnings,
  };
}

/** Mescla dados coletados pelo chatbot. */
export function mergeBotCollected(base: unknown, extra: unknown): Record<string, unknown> {
  const b = (base && typeof base === "object" && !Array.isArray(base) ? base : {}) as Record<string, unknown>;
  const e = (extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...b };
  for (const [k, v] of Object.entries(e)) {
    if (v !== null && v !== undefined && v !== "") {
      if (merged[k] === null || merged[k] === undefined || merged[k] === "") {
        merged[k] = v;
      }
    }
  }
  return merged;
}

const DRAFT_FACT_LABELS: { section: string; field: string; label: string }[] = [
  { section: "patient", field: "full_name", label: "Criança" },
  { section: "patient", field: "birth_date", label: "Nascimento" },
  { section: "patient", field: "cpf", label: "CPF da criança" },
  { section: "patient", field: "cid", label: "CID" },
  { section: "patient", field: "complaint_hint", label: "Queixa" },
  { section: "guardian", field: "full_name", label: "Responsável" },
  { section: "guardian", field: "relationship", label: "Vínculo" },
  { section: "guardian", field: "phone", label: "Telefone" },
  { section: "guardian", field: "email", label: "E-mail" },
  { section: "guardian", field: "cpf", label: "CPF do responsável" },
  { section: "insurance", field: "insurer_name", label: "Plano de saúde" },
  { section: "insurance", field: "card_number", label: "Carteirinha" },
  { section: "insurance", field: "plan_name", label: "Plano" },
  { section: "authorization", field: "guide_number", label: "Guia" },
  { section: "authorization", field: "sessions_authorized", label: "Sessões autorizadas" },
  { section: "authorization", field: "valid_to", label: "Guia válida até" },
];

function buildDraftFacts(extracted: unknown): PendingDraftFact[] {
  if (!extracted || typeof extracted !== "object") return [];
  const root = extracted as Record<string, unknown>;
  const facts: PendingDraftFact[] = [];
  for (const { section, field, label } of DRAFT_FACT_LABELS) {
    const block = root[section];
    if (!block || typeof block !== "object") continue;
    const raw = (block as Record<string, unknown>)[field];
    if (raw === null || raw === undefined || raw === "") continue;
    facts.push({ label, value: String(raw) });
  }
  return facts;
}

export type DraftPendencySources = {
  botByDraft: Map<string, unknown>;
  docCategoriesByPatient: Map<string, string[]>;
  insuredPatients: Set<string>;
  insuredPhones: Set<string>;
};

/**
 * Mescla uma lista de rascunhos do mesmo paciente em um único rascunho consolidado.
 */
export function mergeRegistrationDraftGroup(
  group: PendingRegistrationDraft[],
  pendencySources: DraftPendencySources,
  rawExtractedByDraft?: Map<string, unknown>,
): PendingRegistrationDraft {
  if (group.length === 1) return group[0];

  const primary = pickPrimaryDraft(group);
  const others = group.filter((d) => d.id !== primary.id);

  // 1. Mescla dados extraídos
  let mergedExtracted: Record<string, unknown> = rawExtractedByDraft?.get(primary.id)
    ? (rawExtractedByDraft.get(primary.id) as Record<string, unknown>)
    : {};
  for (const other of others) {
    const otherExtracted = rawExtractedByDraft?.get(other.id);
    if (otherExtracted) {
      mergedExtracted = mergeExtractedData(mergedExtracted, otherExtracted);
    }
  }

  // 2. Mescla dados do bot
  let mergedBot: Record<string, unknown> = (pendencySources.botByDraft.get(primary.id) as Record<string, unknown>) ?? {};
  for (const other of others) {
    const otherBot = pendencySources.botByDraft.get(other.id);
    if (otherBot) {
      mergedBot = mergeBotCollected(mergedBot, otherBot);
    }
  }

  // 3. Mescla arquivos únicos
  const seenFileIds = new Set<string>();
  const mergedFiles: PendingDraftFile[] = [];
  for (const d of group) {
    for (const f of d.files) {
      if (!seenFileIds.has(f.id)) {
        seenFileIds.add(f.id);
        mergedFiles.push(f);
      }
    }
  }

  // 4. Mescla mensagens de conversas de WhatsApp
  const seenMessages = new Set<string>();
  const mergedMessages: PendingDraftMessage[] = [];
  for (const d of group) {
    for (const m of d.messages) {
      const key = `${m.sentAt}_${m.body}`;
      if (!seenMessages.has(key)) {
        seenMessages.add(key);
        mergedMessages.push(m);
      }
    }
  }
  mergedMessages.sort((a, b) => a.sentAt.localeCompare(b.sentAt));

  // 5. Mescla solicitações de documentos
  const seenReqs = new Set<string>();
  const mergedDocRequests: PendingDraftDocumentRequest[] = [];
  for (const d of group) {
    for (const req of d.documentRequests) {
      if (!seenReqs.has(req.key)) {
        seenReqs.add(req.key);
        mergedDocRequests.push(req);
      }
    }
  }

  // 6. Mensagens do responsável
  const guardianMessages = group
    .map((d) => d.guardianMessage?.trim())
    .filter((m): m is string => Boolean(m));
  const uniqueGuardianMessages = [...new Set(guardianMessages)];
  const mergedGuardianMessage = uniqueGuardianMessages.length > 0 ? uniqueGuardianMessages.join(" · ") : null;

  // 7. Fatos consolidados
  const facts = buildDraftFacts(mergedExtracted);

  // 8. Nome do paciente
  const patientExtName = asText((mergedExtracted.patient as Record<string, unknown> | undefined)?.full_name);
  const botChildName = asText(mergedBot.child_name);
  const resolvedPatientName = primary.patientName ?? patientExtName ?? botChildName ?? null;

  // 9. Pipeline
  const guideSentAt = group.map((d) => d.pipeline.guideSentAt).filter(Boolean).sort().reverse()[0] ?? null;
  const authorizedAt = group.map((d) => d.pipeline.authorizedAt).filter(Boolean).sort().reverse()[0] ?? null;
  const schedulingEnabledAt =
    group.map((d) => d.pipeline.schedulingEnabledAt).filter(Boolean).sort().reverse()[0] ?? null;

  const authWaived = group.some((d) => d.pipeline.authorization === "dispensada");
  const authStatus = authorizedAt
    ? "autorizada"
    : authWaived
      ? "dispensada"
      : guideSentAt
        ? "enviada"
        : "pendente";

  const allPhones = [...new Set(group.map((d) => d.sourcePhone).filter((p): p is string => Boolean(p)))];
  const patientId = primary.patientId ?? group.find((d) => d.patientId)?.patientId ?? null;

  // 10. Recalcula pendências com dados unificados
  const pendencies = computeLeadPendencies({
    extracted: mergedExtracted,
    bot: mergedBot,
    fileTypes: mergedFiles.map((f) => f.detectedType),
    patientDocCategories: patientId ? (pendencySources.docCategoriesByPatient.get(patientId) ?? []) : [],
    insurerKnown:
      (patientId ? pendencySources.insuredPatients.has(patientId) : false) ||
      allPhones.some((p) => pendencySources.insuredPhones.has(p)),
    authorizationWaived: authWaived,
    planAuthorizedAt: authorizedAt,
    hasAuthorizedGuide: group.some((d) => Boolean(d.pipeline.authorizedGuide) || Boolean(d.pipeline.authorizationId)),
    draftStatus: primary.status,
    filesCount: mergedFiles.length,
  });

  return {
    ...primary,
    patientId,
    patientName: resolvedPatientName,
    guardianMessage: mergedGuardianMessage,
    files: mergedFiles,
    messages: mergedMessages,
    documentRequests: mergedDocRequests,
    facts: facts.length > 0 ? facts : primary.facts,
    warnings: [...new Set(group.flatMap((d) => d.warnings))],
    pendencies,
    pipeline: {
      ...primary.pipeline,
      authorization: authStatus,
      guideSentAt,
      authorizedAt,
      schedulingEnabledAt,
      registered: group.some((d) => d.pipeline.registered),
    },
    mergedDraftsCount: group.length,
  };
}

/**
 * Persiste a mesclagem dos rascunhos no banco de dados Supabase:
 * - Move os arquivos em `registration_draft_files` para o rascunho principal;
 * - Marca os rascunhos secundários como rejeitados (motivo: mesclado);
 * - Atualiza o rascunho principal com os dados extraídos unificados.
 */
export async function persistDraftMergeInDb(
  adminSupabase: any,
  primaryDraftId: string,
  secondaryDraftIds: string[],
  mergedExtracted: Record<string, unknown>,
  mergedBotCollected: Record<string, unknown>,
  mergedGuardianMessage: string | null,
  patientId: string | null,
): Promise<void> {
  if (secondaryDraftIds.length === 0) return;

  try {
    // 1. Move os arquivos para o rascunho principal
    await adminSupabase
      .from("registration_draft_files")
      .update({ draft_id: primaryDraftId })
      .in("draft_id", secondaryDraftIds);

    // 2. Marca rascunhos secundários como rejeitados/mesclados
    await adminSupabase
      .from("registration_drafts")
      .update({
        status: "rejected",
        reject_reason: `Mesclado com rascunho ${primaryDraftId}`,
      })
      .in("id", secondaryDraftIds);

    // 3. Atualiza o rascunho principal com os dados mesclados
    const updatePayload: Record<string, unknown> = {
      extracted: mergedExtracted,
      bot_collected: mergedBotCollected,
      guardian_message: mergedGuardianMessage,
    };
    if (patientId) {
      updatePayload.patient_id = patientId;
    }

    await adminSupabase
      .from("registration_drafts")
      .update(updatePayload)
      .eq("id", primaryDraftId);
  } catch (err) {
    console.error("[DraftMerge] Erro ao persistir mesclagem de rascunhos no banco:", err);
  }
}

/**
 * Ponto de entrada para consolidar a lista de rascunhos pendentes:
 * 1. Agrupa rascunhos que tratam da mesma criança e responsável;
 * 2. Mescla arquivos, fatos, mensagens e pendências;
 * 3. Persiste a unificação no banco (via admin client em background);
 * 4. Retorna a lista de rascunhos consolidada.
 */
export function consolidateRegistrationDrafts(
  drafts: PendingRegistrationDraft[],
  pendencySources: DraftPendencySources,
  rawExtractedByDraft?: Map<string, unknown>,
): PendingRegistrationDraft[] {
  if (drafts.length <= 1) return drafts;

  const groups = groupMatchingDrafts(drafts, pendencySources.botByDraft);
  const result: PendingRegistrationDraft[] = [];

  for (const group of groups) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const merged = mergeRegistrationDraftGroup(group, pendencySources, rawExtractedByDraft);
      result.push(merged);

      // Persiste no banco de forma assíncrona
      const primaryId = merged.id;
      const secondaryIds = group.filter((d) => d.id !== primaryId).map((d) => d.id);

      // `after` mantém a função viva depois da resposta (IIFE solta é cortada na Vercel).
      const persist = async () => {
        {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const admin = createAdminClient();
          let mergedExtracted: Record<string, unknown> = rawExtractedByDraft?.get(primaryId)
            ? (rawExtractedByDraft.get(primaryId) as Record<string, unknown>)
            : {};
          for (const secId of secondaryIds) {
            const secExt = rawExtractedByDraft?.get(secId);
            if (secExt) mergedExtracted = mergeExtractedData(mergedExtracted, secExt);
          }

          let mergedBot: Record<string, unknown> =
            (pendencySources.botByDraft.get(primaryId) as Record<string, unknown>) ?? {};
          for (const secId of secondaryIds) {
            const secBot = pendencySources.botByDraft.get(secId);
            if (secBot) mergedBot = mergeBotCollected(mergedBot, secBot);
          }

          await persistDraftMergeInDb(
            admin,
            primaryId,
            secondaryIds,
            mergedExtracted,
            mergedBot,
            merged.guardianMessage,
            merged.patientId,
          );
        }
      };
      // Import dinâmico: `next/server` não resolve nos testes em node puro.
      void import("@/lib/after-response")
        .then(({ runAfterResponse }) => {
          if (!runAfterResponse("draft-merge", persist)) return persist();
        })
        .catch((err) => console.error("[DraftMerge] Falha ao mesclar no banco:", err));
    }
  }

  return result;
}
