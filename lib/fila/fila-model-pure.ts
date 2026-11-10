// lib/fila/fila-model-pure.ts
// Modelo da Fila de entrada (/recepcao/fila): famílias novas do WhatsApp, do primeiro contato até o ok de
// agendamento. PURO, sem I/O e sem imports com alias `@/` (testado em tests/fila-model-pure.test.ts).
//
// Por que existe: Autorizações mostrava a mesma informação ("em que etapa está") em 8 lugares e dividia a
// fila por 3 eixos de filtro e 4 quadros. Aqui cada família cai em UM grupo e tem UM próximo passo.
//
// A etapa segue a mesma prioridade da tela atual (draftStage): documento faltando vem antes da guia.

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
  /** Texto normalizado para a busca. */
  searchText: string;
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

function computeGroup(src: FilaSource, unrequested: string[]): FilaGroup {
  if (src.pipeline.schedulingEnabledAt) return "concluidos";
  if (src.missingCount > 0) {
    // Tudo o que falta (e que se pode cobrar) já foi pedido: a bola está com a família.
    return src.missingDocs.length > 0 && unrequested.length === 0 ? "familia" : "agir";
  }
  return src.pipeline.authorization === "enviada" ? "plano" : "agir";
}

function computeStep(src: FilaSource, group: FilaGroup, unrequested: string[], requestedMissing: string[]): FilaStep {
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

export function buildFilaItem(src: FilaSource): FilaItem {
  const requested = new Set(src.documentRequests.map((r) => r.key));
  const unrequested = src.missingDocs.filter((d) => !requested.has(d.key)).map((d) => d.key);
  const requestedMissing = src.missingDocs.filter((d) => requested.has(d.key)).map((d) => d.key);

  const group = computeGroup(src, unrequested);
  const guardian = fact(src.facts, "Responsável");
  const plan = fact(src.facts, "Plano de saúde");

  return {
    id: src.id,
    draftId: src.draftId,
    child: src.patientName,
    guardian,
    plan,
    phone: src.sourcePhone,
    createdAt: src.createdAt,
    group,
    step: computeStep(src, group, unrequested, requestedMissing),
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
    searchText: normalize([src.patientName, guardian ?? "", plan ?? ""].join(" ")),
  };
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
}): [TrailState, TrailState, TrailState, TrailState] {
  if (input.schedulingEnabledAt) return ["done", "done", "done", "done"];
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
