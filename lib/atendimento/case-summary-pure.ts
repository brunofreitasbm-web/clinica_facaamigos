// lib/atendimento/case-summary-pure.ts
// Resumo do caso no painel lateral do Chat. PURO, sem I/O.
//
// Por que existe: para saber "quem é, qual plano, em que etapa está, por que veio para a equipe e o que fazer
// agora" o operador precisava rolar a conversa ou abrir um modal quase em tela cheia. Aqui o que a tela já
// carrega (conversa + rascunho do telefone + cadastro) vira UM resumo com no máximo 5 blocos.
//
// Só LEITURA: nada aqui cria rascunho nem toca no banco (ver AGENTS.md, diretriz 3, sobre duplicidade).

import { intakeStage, intakeStageLabel, type IntakeInput } from "../intake-queue-pure.ts";

const ESCALATION_LABELS: Record<string, string> = {
  fora_da_base: "A dúvida não está na base de conhecimento do bot.",
  clinico: "Pergunta clínica sobre a criança — o bot não responde.",
  pediu_humano: "A pessoa pediu para falar com alguém da equipe.",
  relatorio: "Pedido de relatório/documento — dados coletados na última mensagem do bot, veja a conversa.",
  lista_espera: "Quer entrar na lista de espera — nome, idade, plano e terapia estão no resumo da última mensagem do bot.",
  particular: "Venda particular: quer falar com um atendente sobre o atendimento particular.",
  particular_agendar: "Venda particular: quer agendar a avaliação — nome, idade e queixa estão na última mensagem da família.",
};

/** Motivo (em português) de a conversa ter ido para a equipe; `null` se vazio ou desconhecido. */
export function escalationLabel(reason: string | null | undefined): string | null {
  return reason ? (ESCALATION_LABELS[reason] ?? null) : null;
}

/** Nascimento em ISO (aaaa-mm-dd) a partir de ISO ou dd/mm/aaaa; datas impossíveis viram `null`. */
export function parseBirthDate(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (br) {
    [day, month, year] = [Number(br[1]), Number(br[2]), Number(br[3])];
  } else {
    return null;
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "4 anos", "1 ano e 8 meses", "10 meses", "menos de 1 mês"; `null` sem data ou com data no futuro. */
export function ageLabel(birthIso: string | null | undefined, nowMs: number): string | null {
  if (!birthIso) return null;
  const [by, bm, bd] = birthIso.split("-").map(Number);
  const now = new Date(nowMs);
  const [ny, nm, nd] = [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()];
  const months = (ny - by) * 12 + (nm - bm) - (nd < bd ? 1 : 0);
  if (months < 0) return null;
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years >= 2) return `${years} anos`;
  return rest > 0 ? `1 ano e ${rest} ${rest === 1 ? "mês" : "meses"}` : "1 ano";
}

export type CaseDraftInput = {
  id: string;
  status: string;
  facts: { label: string; value: string }[];
  pipeline: {
    authorization: "pendente" | "enviada" | "autorizada" | "dispensada";
    schedulingEnabledAt: string | null;
    registered: boolean;
    returned: { reason: string; byName: string | null } | null;
  };
  /** Entrada da etapa da Fila de entrada (`toIntakeInput` em lib/intake-queue-build-pure.ts). */
  intake: IntakeInput;
  missingCount: number;
  /** Texto de `pendencies.summary` ("Faltam carteirinha e laudo"). */
  missingSummary: string;
  filesCount: number;
};

export type CaseSummaryInput = {
  conversation: {
    kind: "lead" | "patient";
    phoneNumber: string;
    displayName: string;
    contactName: string | null;
    guardianName: string | null;
    /** Plano que a lista já mostra (cadastro do paciente ou convênio que o bot identificou). */
    planName: string | null;
    escalationReason: string | null;
    patientId: string | null;
    patientStatus: string | null;
  };
  /** Rascunho ABERTO do telefone (lido, nunca criado aqui); `null` quando não há. */
  draft: CaseDraftInput | null;
  patient: { fullName: string; birthDate: string | null } | null;
  insurance: { insurerName: string; planName: string | null }[];
  nowMs: number;
};

export type NextStep = {
  kind: "resolve_pendencies" | "open_authorization" | "open_patient" | "none";
  label: string;
  href?: string;
  note?: string;
};

export type CaseSummaryView = {
  headline: string;
  details: { label: string; value: string }[];
  plan: { text: string; tone: "known" | "particular" | "unknown" };
  /** Etapa da trilha de autorização (só para quem ainda não é paciente com prontuário). */
  stage: { label: string; allDone: boolean } | null;
  warning: string | null;
  reason: string | null;
  next: NextStep;
};

const fact = (facts: { label: string; value: string }[], label: string): string | null =>
  facts.find((f) => f.label === label)?.value.trim() || null;

/** Paciente com prontuário de verdade: "interessado" é lead com cadastro incompleto. */
function hasRecord(c: CaseSummaryInput["conversation"]): boolean {
  return Boolean(c.patientId) && c.patientStatus !== "interessado";
}

export function buildCaseSummary(input: CaseSummaryInput): CaseSummaryView {
  const { conversation: c, draft, patient, insurance } = input;
  const facts = draft?.facts ?? [];
  const record = hasRecord(c);

  const headline = patient?.fullName || fact(facts, "Criança") || c.contactName || c.displayName;

  const birthIso = parseBirthDate(patient?.birthDate ?? fact(facts, "Nascimento"));
  const age = ageLabel(birthIso, input.nowMs);
  const guardian = c.guardianName || fact(facts, "Responsável");
  const relationship = fact(facts, "Vínculo");

  const details: { label: string; value: string }[] = [];
  if (birthIso) details.push({ label: "Idade", value: age ? `${age} (${formatBr(birthIso)})` : formatBr(birthIso) });
  if (guardian) details.push({ label: "Responsável", value: relationship ? `${guardian} (${relationship})` : guardian });

  const insurer = insurance[0];
  const factInsurer = fact(facts, "Plano de saúde");
  const factPlan = fact(facts, "Plano");
  let plan: CaseSummaryView["plan"];
  if (insurer) {
    plan = { text: insurer.planName ? `${insurer.insurerName} · ${insurer.planName}` : insurer.insurerName, tone: "known" };
  } else if (factInsurer) {
    plan = { text: factPlan ? `${factInsurer} · ${factPlan}` : factInsurer, tone: "known" };
  } else if (c.planName) {
    plan = { text: c.planName, tone: "known" };
  } else if (record) {
    plan = { text: "Particular", tone: "particular" };
  } else {
    plan = { text: "Plano não informado", tone: "unknown" };
  }

  const stage =
    draft && !record ? { label: intakeStageLabel(draft.intake), allDone: intakeStage(draft.intake) === 4 } : null;
  const stageView = stage;

  const returned = draft?.pipeline.returned ?? null;
  const warning = returned
    ? `Devolvido pela supervisão: ${returned.reason}${returned.byName ? ` (${returned.byName})` : ""}`
    : null;

  let next: NextStep = { kind: "none", label: "" };
  if (record && c.patientId) {
    next = { kind: "open_patient", label: "Abrir ficha do paciente", href: `/recepcao/pacientes/${c.patientId}` };
  } else if (draft) {
    if (draft.missingCount > 0) {
      next = {
        kind: "resolve_pendencies",
        label: "Resolver pendências",
        note: draft.missingSummary || `Faltam ${draft.missingCount} ${draft.missingCount === 1 ? "item" : "itens"}`,
      };
    } else if (stage && !stage.allDone) {
      next = {
        kind: "open_authorization",
        label: "Abrir em Autorizações",
        href: `/recepcao/a-autorizar?item=${encodeURIComponent(draft.id)}`,
      };
    } else if (stage?.allDone) {
      next = { kind: "none", label: "", note: "Pronto para agendar a 1ª avaliação." };
    }
  } else if (!record) {
    // Lead sem rascunho ainda: "Resolver pendências" é o que o abre na fila (todo lead clicado entra nela).
    next = { kind: "resolve_pendencies", label: "Resolver pendências", note: "Nenhum documento ou dado recebido ainda." };
  }

  return {
    headline,
    details,
    plan,
    stage: stageView,
    warning,
    reason: escalationLabel(c.escalationReason),
    next,
  };
}
