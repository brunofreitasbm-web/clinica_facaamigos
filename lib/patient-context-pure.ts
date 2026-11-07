// lib/patient-context-pure.ts
// Bloco de contexto do PACIENTE VINCULADO para o prompt do agente de FAQ. Puro (sem alias
// `@/`) para rodar em `node --test --experimental-strip-types`
// (tests/patient-context-pure.test.ts). A leitura do banco fica em lib/patient-context.ts.
//
// Privacidade: só o mínimo para personalizar e antecipar — primeiro nome da criança, situação
// da guia vigente (vencimento e sessões restantes) e a próxima sessão (dia e hora). Sem
// sobrenome, terapeuta, diagnóstico, documentos ou valores.

export type PatientContext = {
  childFirstName: string | null;
  /** Guia ativa de menor vencimento: `YYYY-MM-DD`. */
  guideValidTo: string | null;
  guideSessionsLeft: number | null;
  /** Texto pronto ("seg., 10/11 às 14:00"). */
  nextSessionLabel: string | null;
  nextSessionIsEvaluation: boolean;
};

/** Antecedência (dias) e saldo (sessões) a partir dos quais o bot avisa da guia sem ser perguntado. */
export const GUIDE_WARN_DAYS = 30;
export const GUIDE_WARN_SESSIONS = 4;

function daysBetween(todayIso: string, targetIso: string): number {
  const a = Date.parse(`${todayIso}T00:00:00Z`);
  const b = Date.parse(`${targetIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

/** Aviso proativo sobre a guia, ou `null` quando está tudo tranquilo. */
export function guideWarning(ctx: PatientContext, todayIso: string): string | null {
  const parts: string[] = [];
  if (ctx.guideValidTo) {
    const days = daysBetween(todayIso, ctx.guideValidTo);
    if (Number.isFinite(days) && days < 0) parts.push("a guia vigente já venceu");
    else if (Number.isFinite(days) && days <= GUIDE_WARN_DAYS) parts.push(`a guia vigente vence em ${days} dia(s)`);
  }
  if (ctx.guideSessionsLeft !== null && ctx.guideSessionsLeft <= GUIDE_WARN_SESSIONS) {
    parts.push(ctx.guideSessionsLeft <= 0 ? "as sessões da guia acabaram" : `restam apenas ${ctx.guideSessionsLeft} sessão(ões) na guia`);
  }
  return parts.length ? parts.join(" e ") : null;
}

/** Bloco de texto para o prompt; vazio quando não há nada útil (paciente sem dados). */
export function buildPatientContextBlock(ctx: PatientContext | null | undefined, todayIso: string): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.childFirstName) lines.push(`- Criança/paciente: ${ctx.childFirstName} (use só o primeiro nome, com naturalidade).`);
  if (ctx.nextSessionLabel) {
    lines.push(`- Próxima ${ctx.nextSessionIsEvaluation ? "avaliação" : "sessão"} agendada: ${ctx.nextSessionLabel}.`);
  }
  if (ctx.guideValidTo) {
    const left = ctx.guideSessionsLeft !== null ? `; sessões restantes: ${ctx.guideSessionsLeft}` : "";
    lines.push(`- Guia vigente: válida até ${ctx.guideValidTo.split("-").reverse().join("/")}${left}.`);
  }
  const warning = guideWarning(ctx, todayIso);
  if (warning) lines.push(`- AVISO DE GUIA: ${warning}.`);
  if (lines.length === 0) return "";

  return [
    "CONTEXTO DO PACIENTE (responsável já cadastrado — dado interno):",
    ...lines,
    "Regras de uso: use estes dados só para responder com precisão (ex.: 'quando é a próxima sessão?') e para acolher pelo nome; NÃO os recite sem a pessoa perguntar e NUNCA invente além do que está aqui. Pergunta sobre outro dado da criança, terapeuta ou evolução: escale.",
    warning
      ? "AVISO PROATIVO: ao final da resposta, em UMA frase curta, avise do aviso de guia acima e ofereça chamar a recepção para providenciar a renovação — exceto se a pessoa estiver aflita, reclamando ou tratando de assunto urgente (aí só acolha). Nunca prometa prazo de aprovação."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
