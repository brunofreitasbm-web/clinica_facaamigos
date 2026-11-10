// lib/fila/fila-model-pure.ts
// Modelo da Fila de entrada (/recepcao/fila): famílias novas do WhatsApp, do primeiro contato até o ok de
// agendamento. PURO, sem I/O e sem imports com alias `@/` (testado em tests/fila-model-pure.test.ts).
//
// Por que existe: Autorizações mostrava a mesma informação ("em que etapa está") em 8 lugares e dividia a
// fila por 3 eixos de filtro e 4 quadros. Aqui cada família cai em UM grupo e tem UM próximo passo.
//
// A etapa segue a mesma prioridade da tela atual (draftStage): documento faltando vem antes da guia.

import { MAX_MEMBER_IDS } from "./fila-detail-pure.ts";

export type FilaGroup = "agir" | "familia" | "plano" | "concluidos";

export const FILA_GROUPS: { key: FilaGroup; label: string; hint: string }[] = [
  { key: "agir", label: "Agir agora", hint: "Quem espera há mais tempo aparece primeiro" },
  { key: "familia", label: "Aguardando família", hint: "Pedido enviado: acompanhe e lembre se precisar" },
  { key: "plano", label: "Aguardando plano", hint: "Guia enviada: registre a resposta quando chegar" },
  { key: "concluidos", label: "Concluídos", hint: "Agendamento habilitado: agora é com a Supervisão" },
];

export type FilaSource = {
  /** Id do item da fila (seleção, dono e prazo). */
  id: string;
  draftId: string;
  /** Rascunhos mesclados neste caso (principal primeiro); ausente vale só `[draftId]`. */
  memberDraftIds?: string[];
  patientName: string;
  sourcePhone: string | null;
  /** Quando o contato entrou (`registration_drafts.created_at`). */
  createdAt: string;
  /** `draft.facts`: pares já lidos (Responsável, Plano de saúde...). */
  facts: { label: string; value: string }[];
  pipeline: {
    authorization: "pendente" | "enviada" | "autorizada" | "dispensada";
    schedulingEnabledAt: string | null;
    returned: { reason: string; byName: string | null } | null;
    /** Ausentes valem null (migração pendente ou chamador antigo). */
    guideSentAt?: string | null;
    planDeniedAt?: string | null;
    planAskedMoreDocsAt?: string | null;
  };
  /** `pendencies.missingCount`: documentos E dados que faltam. */
  missingCount: number;
  /** Só os documentos que faltam e que se pode cobrar da família (têm modelo de mensagem). */
  missingDocs: { key: string; label: string }[];
  /** Cobranças de documento já enviadas a este telefone. */
  documentRequests: { key: string; sentAt: string }[];
  assignedToId: string | null;
  assignedToName: string | null;
  /** Prazo do sistema vencido (ou escalado): o mesmo que a tela atual usa. */
  overdue: boolean;
  /** "Deixar para depois": foi para o fim da fila. */
  postponed: boolean;
};

export type FilaStepKind =
  | "ask_documents"
  | "wait_family"
  | "review_data"
  | "send_guide"
  | "plan_more_docs"
  | "wait_plan"
  | "enable_scheduling"
  | "with_supervision";

export type FilaStep = {
  kind: FilaStepKind;
  /** Frase da lista (uma linha). */
  listText: string;
  /** Título do cartão "Próximo passo" no detalhe. */
  title: string;
  description: string;
  /** `null` quando não há nada a fazer (a bola está com outra equipe). */
  primaryLabel: string | null;
};

export type FilaItem = {
  id: string;
  draftId: string;
  /** Rascunhos mesclados nesta família: o detalhe consolida só eles (mesmo caso da lista, sem reler a fila). */
  memberDraftIds: string[];
  child: string;
  guardian: string | null;
  plan: string | null;
  phone: string | null;
  createdAt: string;
  group: FilaGroup;
  step: FilaStep;
  /** Documentos ainda NÃO pedidos à família (o que "Pedir documentos" envia). */
  askKeys: string[];
  /** Documentos já pedidos e ainda faltando (o que "Enviar lembrete" reenvia). */
  remindKeys: string[];
  returned: { reason: string; byName: string | null } | null;
  authorization: FilaSource["pipeline"]["authorization"];
  schedulingEnabledAt: string | null;
  missingCount: number;
  assignedToId: string | null;
  assignedToName: string | null;
  overdue: boolean;
  postponed: boolean;
  /** Resposta do plano que ainda vale (negou ou pediu mais documentos); null quando nenhuma. */
  planOutcome: PlanOutcome;
  planOutcomeAt: string | null;
  /** Documentos a pedir à família quando o plano pediu mais (todos os que faltam); vazio fora desse caso. */
  moreDocsKeys: string[];
  /** Texto normalizado para a busca. */
  searchText: string;
};

/** Dias sem resposta da família, depois da cobrança do pedido do plano, até a fila voltar para Agir agora. */
export const FAMILY_WAIT_DAYS = 3;

export type PlanOutcome = "denied" | "more_docs" | null;

const DAY_MS = 24 * 60 * 60 * 1000;

function ms(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Negativa e pedido de mais documentos que ainda valem. Uma marca deixa de valer quando:
 *   - o plano autorizou (ou o caso foi dispensado como particular), ou
 *   - a guia foi enviada de novo depois dela (guideSentAt mais novo que a marca).
 * Com as duas valendo, fica só a mais recente: é a última resposta do plano.
 */
export function activePlanOutcome(p: {
  authorization: FilaSource["pipeline"]["authorization"];
  guideSentAt: string | null;
  planDeniedAt: string | null;
  planAskedMoreDocsAt: string | null;
}): { planDeniedAt: string | null; planAskedMoreDocsAt: string | null } {
  if (p.authorization === "autorizada" || p.authorization === "dispensada") {
    return { planDeniedAt: null, planAskedMoreDocsAt: null };
  }
  const sent = ms(p.guideSentAt);
  const stillOpen = (at: string | null) => {
    const t = ms(at);
    if (t === null) return false;
    return sent === null || sent <= t;
  };
  let denied = stillOpen(p.planDeniedAt) ? p.planDeniedAt : null;
  let asked = stillOpen(p.planAskedMoreDocsAt) ? p.planAskedMoreDocsAt : null;
  if (denied && asked) {
    if ((ms(denied) ?? 0) >= (ms(asked) ?? 0)) asked = null;
    else denied = null;
  }
  return { planDeniedAt: denied, planAskedMoreDocsAt: asked };
}

/** Situação do pedido de mais documentos do plano, a partir das cobranças enviadas depois dele. */
type MoreDocsState = { chasedAt: string | null; chasedDays: number };

function moreDocsState(src: FilaSource, askedAt: string, nowMs: number): MoreDocsState {
  const askedMs = ms(askedAt) ?? 0;
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const r of src.documentRequests) {
    const t = ms(r.sentAt);
    if (t !== null && t >= askedMs && t > bestMs) {
      bestMs = t;
      best = r.sentAt;
    }
  }
  return { chasedAt: best, chasedDays: best ? Math.max(0, Math.floor((nowMs - bestMs) / DAY_MS)) : 0 };
}

type OutcomeCtx = {
  outcome: PlanOutcome;
  moreDocs: MoreDocsState | null;
};

const fact = (facts: FilaSource["facts"], label: string): string | null =>
  facts.find((f) => f.label === label)?.value.trim() || null;

/** minúsculas e sem acento. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const digitsOf = (text: string): string => text.replace(/\D/g, "");

function listLabels(docs: { key: string; label: string }[], keys: string[]): string {
  return docs
    .filter((d) => keys.includes(d.key))
    .map((d) => d.label.toLowerCase())
    .join(", ");
}

function computeGroup(src: FilaSource, unrequested: string[], ctx: OutcomeCtx): FilaGroup {
  if (src.pipeline.schedulingEnabledAt) return "concluidos";
  if (ctx.outcome === "denied") return "agir";
  if (ctx.outcome === "more_docs" && ctx.moreDocs) {
    const { chasedAt, chasedDays } = ctx.moreDocs;
    if (chasedAt && src.missingDocs.length === 0) return "agir";
    if (chasedAt && chasedDays < FAMILY_WAIT_DAYS) return "familia";
    return "agir";
  }
  if (src.missingCount > 0) {
    // Tudo o que falta (e que se pode cobrar) já foi pedido: a bola está com a família.
    return src.missingDocs.length > 0 && unrequested.length === 0 ? "familia" : "agir";
  }
  return src.pipeline.authorization === "enviada" ? "plano" : "agir";
}

/** Passo quando o plano respondeu (negou ou pediu mais documentos); null segue o fluxo comum. */
function computeOutcomeStep(src: FilaSource, group: FilaGroup, requestedMissing: string[], ctx: OutcomeCtx): FilaStep | null {
  if (group === "concluidos") return null;
  const resend = (listText: string): FilaStep => ({
    kind: "send_guide",
    listText,
    title: "Enviar a guia de novo",
    description:
      ctx.outcome === "denied"
        ? `O plano negou a guia. Ajuste o que for preciso e envie de novo.${src.missingCount > 0 ? " Ainda faltam documentos: o plano pode negar de novo." : ""}`
        : "Os documentos que o plano pediu chegaram. Envie a guia de novo e registre aqui.",
    primaryLabel: "Registrar guia enviada",
  });
  if (ctx.outcome === "denied") return resend("Plano negou: enviar a guia de novo");
  if (ctx.outcome !== "more_docs" || !ctx.moreDocs) return null;
  const { chasedAt, chasedDays } = ctx.moreDocs;
  if (chasedAt && src.missingDocs.length === 0) return resend("Documentos chegaram: reenviar a guia");
  const canRemind = requestedMissing.length > 0;
  if (group === "familia") {
    return {
      kind: "wait_family",
      listText: "Plano pediu mais documentos: aguardando a família",
      title: "Aguardando a família",
      description:
        "Pedido enviado. Quando os documentos chegarem, a família volta sozinha para Agir agora. Se demorar, envie um lembrete.",
      primaryLabel: canRemind ? "Enviar lembrete" : "Abrir conversa no Chat",
    };
  }
  const hasKeys = src.missingDocs.length > 0;
  return {
    kind: "plan_more_docs",
    listText: chasedAt
      ? `Plano pediu mais documentos: família sem resposta há ${chasedDays} dias`
      : "Plano pediu mais documentos",
    title: "O plano pediu mais documentos",
    description: "Peça à família o que o plano pediu. Quando chegar, registre a guia enviada de novo.",
    primaryLabel: hasKeys ? "Pedir documentos à família" : "Abrir conversa no Chat",
  };
}

function computeStep(
  src: FilaSource,
  group: FilaGroup,
  unrequested: string[],
  requestedMissing: string[],
  ctx: OutcomeCtx,
): FilaStep {
  const outcomeStep = computeOutcomeStep(src, group, requestedMissing, ctx);
  if (outcomeStep) return outcomeStep;
  if (group === "concluidos") {
    return {
      kind: "with_supervision",
      listText: "Com a Supervisão para marcar a 1ª avaliação",
      title: "Com a Supervisão",
      description:
        "Agendamento habilitado. A família recebe os horários por WhatsApp e a Supervisão confirma na agenda de 1ª avaliação.",
      primaryLabel: null,
    };
  }
  if (group === "familia") {
    const labels = listLabels(src.missingDocs, requestedMissing);
    return {
      kind: "wait_family",
      listText: `Família precisa enviar: ${labels}`,
      title: "Aguardando a família",
      description:
        "Pedido enviado. Quando os documentos chegarem, a família volta sozinha para Agir agora. Se demorar, envie um lembrete.",
      primaryLabel: "Enviar lembrete",
    };
  }
  if (group === "plano") {
    return {
      kind: "wait_plan",
      listText: "Plano analisando a guia",
      title: "Aguardando o plano",
      description: "Guia enviada ao plano. Quando a resposta chegar, registre aqui.",
      primaryLabel: "Plano autorizou",
    };
  }
  // Agir agora
  if (src.missingCount > 0) {
    if (unrequested.length > 0) {
      const labels = listLabels(src.missingDocs, unrequested);
      return {
        kind: "ask_documents",
        listText: `Pedir à família: ${labels}`,
        title: "Pedir à família o que falta",
        description: `Faltam: ${labels}. A mensagem já vem pronta, você só confere.`,
        primaryLabel: "Pedir documentos à família",
      };
    }
    return {
      kind: "review_data",
      listText: "Conferir o cadastro: faltam dados",
      title: "Completar os dados",
      description: "Faltam dados que a família ainda não informou. Confira o cadastro e complete o que for possível.",
      primaryLabel: "Conferir cadastro",
    };
  }
  if (src.pipeline.authorization === "pendente") {
    return {
      kind: "send_guide",
      listText: "Enviar a guia ao plano",
      title: "Enviar a guia ao plano",
      description: "Documentos completos. Envie a guia pelo portal do plano e registre o envio aqui.",
      primaryLabel: "Registrar guia enviada",
    };
  }
  return {
    kind: "enable_scheduling",
    listText: "Habilitar o agendamento",
    title: "Habilitar o agendamento",
    description:
      "Autorização registrada. Ao habilitar, a família recebe os horários por WhatsApp e a Supervisão confirma na agenda de 1ª avaliação.",
    primaryLabel: "Habilitar agendamento",
  };
}

/**
 * Ids que o detalhe consolida: o principal primeiro, sem repetir, no máximo MAX_MEMBER_IDS (o teto da rota;
 * passar dele faria o detalhe falhar sempre). Num caso maior que o teto, o detalhe consolida os primeiros.
 */
function memberIdsFor(src: FilaSource): string[] {
  const ids = [src.draftId, ...(src.memberDraftIds ?? []).filter((id) => id !== src.draftId)];
  return [...new Set(ids)].slice(0, MAX_MEMBER_IDS);
}

export function buildFilaItem(src: FilaSource, nowMs: number): FilaItem {
  const requested = new Set(src.documentRequests.map((r) => r.key));
  const unrequested = src.missingDocs.filter((d) => !requested.has(d.key)).map((d) => d.key);
  const requestedMissing = src.missingDocs.filter((d) => requested.has(d.key)).map((d) => d.key);

  const active = activePlanOutcome({
    authorization: src.pipeline.authorization,
    guideSentAt: src.pipeline.guideSentAt ?? null,
    planDeniedAt: src.pipeline.planDeniedAt ?? null,
    planAskedMoreDocsAt: src.pipeline.planAskedMoreDocsAt ?? null,
  });
  // Habilitado vence qualquer resposta do plano.
  const outcome: PlanOutcome = src.pipeline.schedulingEnabledAt
    ? null
    : active.planDeniedAt
      ? "denied"
      : active.planAskedMoreDocsAt
        ? "more_docs"
        : null;
  const ctx: OutcomeCtx = {
    outcome,
    moreDocs: outcome === "more_docs" && active.planAskedMoreDocsAt ? moreDocsState(src, active.planAskedMoreDocsAt, nowMs) : null,
  };

  const group = computeGroup(src, unrequested, ctx);
  const guardian = fact(src.facts, "Responsável");
  const plan = fact(src.facts, "Plano de saúde");

  return {
    id: src.id,
    draftId: src.draftId,
    memberDraftIds: memberIdsFor(src),
    child: src.patientName,
    guardian,
    plan,
    phone: src.sourcePhone,
    createdAt: src.createdAt,
    group,
    step: computeStep(src, group, unrequested, requestedMissing, ctx),
    askKeys: unrequested,
    remindKeys: requestedMissing,
    returned: src.pipeline.returned,
    authorization: src.pipeline.authorization,
    schedulingEnabledAt: src.pipeline.schedulingEnabledAt,
    missingCount: src.missingCount,
    assignedToId: src.assignedToId,
    assignedToName: src.assignedToName,
    overdue: src.overdue,
    postponed: src.postponed,
    planOutcome: outcome,
    planOutcomeAt: outcome === "denied" ? active.planDeniedAt : outcome === "more_docs" ? active.planAskedMoreDocsAt : null,
    moreDocsKeys: outcome === "more_docs" ? src.missingDocs.map((d) => d.key) : [],
    searchText: normalize([src.patientName, guardian ?? "", plan ?? ""].join(" ")),
  };
}

/** `?item=` da página: acha a família pelo id do item, pelo rascunho principal ou por um rascunho mesclado nela. */
export function findFilaItem(items: FilaItem[], requested: string): FilaItem | null {
  return (
    items.find((i) => i.id === requested || i.draftId === requested) ??
    items.find((i) => i.memberDraftIds.includes(requested)) ??
    null
  );
}

/** Etapa em uma frase para o painel do Chat: a mesma da lista da Fila (um vocabulário só). */
export function filaStageSummary(item: FilaItem): { label: string; allDone: boolean } {
  return { label: item.step.listText, allDone: item.group === "concluidos" };
}

/** "hoje", "há 1 dia", "há 9 dias", com "atrasado, " quando o prazo do sistema venceu; vazio se a data for inválida. */
export function waitLabel(createdAt: string, nowMs: number, overdue: boolean): string {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return "";
  const days = Math.max(0, Math.floor((nowMs - created) / (24 * 60 * 60 * 1000)));
  const base = days < 1 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
  return overdue ? `atrasado, ${base}` : base;
}

/** Quem espera há mais tempo primeiro; o que foi deixado para depois vai ao fim (estável nos empates). */
export function sortFila(items: FilaItem[]): FilaItem[] {
  return [...items].sort((a, b) => {
    if (a.postponed !== b.postponed) return a.postponed ? 1 : -1;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
}

export type FilaFilter = { mine: boolean; userId: string | null; query: string };

function matchesFilter(item: FilaItem, f: FilaFilter): boolean {
  if (f.mine && (!f.userId || item.assignedToId !== f.userId)) return false;
  const q = normalize(f.query);
  if (!q) return true;
  if (item.searchText.includes(q)) return true;
  const digits = digitsOf(f.query);
  return digits.length >= 3 && digitsOf(item.phone ?? "").includes(digits);
}

export function filterFila(items: FilaItem[], f: FilaFilter & { tab: FilaGroup }): FilaItem[] {
  return items.filter((i) => i.group === f.tab && matchesFilter(i, f));
}

/** Contagem de cada aba com "Só os meus" e a busca aplicados (a aba em si não filtra a contagem). */
export function countByGroup(items: FilaItem[], f: FilaFilter): Record<FilaGroup, number> {
  const counts: Record<FilaGroup, number> = { agir: 0, familia: 0, plano: 0, concluidos: 0 };
  for (const item of items) if (matchesFilter(item, f)) counts[item.group] += 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Detalhe: trilha, histórico e dados para copiar
// ---------------------------------------------------------------------------

export type TrailState = "done" | "current" | "locked";

export const TRAIL_LABELS = ["Documentos", "Guia ao plano", "Autorização", "Agendamento"] as const;

/**
 * Estado das 4 etapas do detalhe. Diferente da trilha antiga, a etapa 1 NÃO é sempre "feita": com documento
 * faltando ela é a da vez e trava as demais. Habilitado conclui tudo.
 */
export function trailStates(input: {
  authorization: FilaSource["pipeline"]["authorization"];
  schedulingEnabledAt: string | null;
  missingCount: number;
  planOutcome?: PlanOutcome;
}): [TrailState, TrailState, TrailState, TrailState] {
  if (input.schedulingEnabledAt) return ["done", "done", "done", "done"];
  if (input.planOutcome === "denied") return ["done", "current", "locked", "locked"];
  if (input.planOutcome === "more_docs") return ["current", "locked", "locked", "locked"];
  if (input.missingCount > 0) return ["current", "locked", "locked", "locked"];
  const waived = input.authorization === "dispensada";
  const sentDone = waived || input.authorization !== "pendente";
  const authDone = waived || input.authorization === "autorizada";
  return ["done", sentDone ? "done" : "current", authDone ? "done" : sentDone ? "current" : "locked", authDone ? "current" : "locked"];
}

export type FilaHistoryEvent = { at: string; text: string };

const DOC_LABELS: Record<string, string> = {
  laudo_medico: "laudo médico",
  pedido_medico: "pedido médico",
  carteirinha: "carteirinha",
  documento_responsavel: "documento do responsável",
  certidao_nascimento: "certidão de nascimento",
  comprovante_residencia: "comprovante de residência",
};

/** Linha do tempo do contato, do mais recente ao mais antigo, só com o que de fato aconteceu. */
export function buildHistory(input: {
  createdAt: string;
  pipeline: {
    guideSentAt: string | null;
    guideSentByName: string | null;
    authorizedAt: string | null;
    authorizedByName: string | null;
    schedulingEnabledAt: string | null;
    returned: { at: string; reason: string; byName: string | null } | null;
    planDeniedAt?: string | null;
    planAskedMoreDocsAt?: string | null;
  };
  documentRequests: { key: string; sentAt: string }[];
}): FilaHistoryEvent[] {
  const events: FilaHistoryEvent[] = [{ at: input.createdAt, text: "Contato iniciado pelo WhatsApp." }];
  for (const r of input.documentRequests) {
    events.push({ at: r.sentAt, text: `Pedido de ${DOC_LABELS[r.key] ?? r.key} enviado à família.` });
  }
  const { pipeline: p } = input;
  if (p.guideSentAt) {
    events.push({ at: p.guideSentAt, text: `Guia enviada ao plano${p.guideSentByName ? ` por ${p.guideSentByName}` : ""}.` });
  }
  if (p.authorizedAt) {
    events.push({ at: p.authorizedAt, text: `Plano autorizou${p.authorizedByName ? ` (registrado por ${p.authorizedByName})` : ""}.` });
  }
  if (p.planDeniedAt) events.push({ at: p.planDeniedAt, text: "Plano negou a guia." });
  if (p.planAskedMoreDocsAt) events.push({ at: p.planAskedMoreDocsAt, text: "Plano pediu mais documentos." });
  if (p.schedulingEnabledAt) events.push({ at: p.schedulingEnabledAt, text: "Agendamento habilitado." });
  if (p.returned) {
    events.push({
      at: p.returned.at,
      text: `Devolvido pela Supervisão${p.returned.byName ? ` (${p.returned.byName})` : ""}: ${p.returned.reason}`,
    });
  }
  // Sort estável: eventos no mesmo instante mantêm a ordem em que foram empilhados (o mais "tardio" do fluxo por último).
  return events
    .map((e, order) => ({ e, order }))
    .sort((a, b) => Date.parse(b.e.at) - Date.parse(a.e.at) || b.order - a.order)
    .map(({ e }) => e);
}

const PORTAL_ORDER = ["Responsável", "Telefone", "Plano de saúde", "Carteirinha"];

/** Dados que a recepção copia para o portal do plano: só os que existem, na ordem de preenchimento. */
export function portalFields(facts: { label: string; value: string }[]): { label: string; value: string }[] {
  return PORTAL_ORDER.flatMap((label) => {
    const value = facts.find((f) => f.label === label)?.value.trim();
    return value ? [{ label, value }] : [];
  });
}
