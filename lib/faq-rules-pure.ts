// lib/faq-rules-pure.ts
// Camada de REGRAS (sem IA) que roda ANTES do agente de FAQ do WhatsApp
// (lib/twilio-faq-bot.ts). Só responde perguntas simples e inequívocas, com
// texto que já está no banco (convênios ativos e `clinic_faq`, escrito pelo
// gestor). Qualquer dúvida — pergunta composta, valor, reembolso, terapia,
// agendamento, pedido de humano, reclamação, dado pessoal — devolve `null` e a
// mensagem segue para o Gemini como antes. Errar para o lado do "não sei" custa
// só uma chamada de IA; errar para o outro lado é a família receber a resposta
// errada, então todos os filtros aqui são deliberadamente restritivos.
//
// Sem import com alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/faq-rules-pure.test.ts).

export type FaqRuleEntry = { question: string; answer: string; keywords: string[] };

export type FaqRuleData = {
  /** Convênios ativos (sem o "Particular"). */
  insurers: string[];
  faq: FaqRuleEntry[];
};

export type FaqRuleMatch = { reply: string; intent: "faq_regra_convenio" | "faq_regra_lista_convenios" | "faq_regra_faq" };

const MAX_TOKENS = 10;

export function normalizeForRules(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Bloqueios, comparados sobre texto normalizado (sem acento, minúsculo), por
// palavra inteira ou prefixo. Dois níveis:
// - STRONG vale para TODAS as regras: pedido de humano, reclamação, assunto
//   clínico, emprego, negação, "meu filho/tenho" (a IA registra o convênio da
//   família) e pergunta composta.
// - TOPICAL vale só para as regras de convênio (1 e 2): dinheiro, terapia
//   específica, documento e agendamento são decisões que a regra não toma. Na
//   regra de `clinic_faq` (3) o próprio tema já é dado pela palavra-chave que o
//   gestor cadastrou, então esses termos não a bloqueiam.
// - TIMEBOUND: mensagem sobre um dia/hora concreto não é pergunta genérica.
const STRONG: RegExp[] = [
  /\b(humano|atendente|recepcao|gerente|supervisor|alguem|pessoa|reclam\w*|insatisf\w*|pessimo|absurdo|cancel\w*)\b/,
  /\b(diagnostic\w*|sintoma\w*|laudo\w*|relatorio\w*|atestado\w*|declaracao|receita\w*|tea|autis\w*|neuro\w*)\b/,
  /\b(emprego|curriculo\w*|trabalh\w*|estagio|contrat\w*)\b/,
  /\b(nao|nunca|tem|tenho|temos|possui|possuo|somos|uso|usamos|meu|minha|filho|filha)\b/,
];
const TOPICAL: RegExp[] = [
  /\b(reembols\w*|coparticip\w*|valor\w*|valores|preco\w*|quanto|mensalidade|tabela|desconto\w*|pagamento|pagar|boleto|nota fiscal)\b/,
  /\b(guia\w*|autoriza\w*|carteirinha|cartao)\b/,
  /\b(fono\w*|psico\w*|ocupacional|aba|terapia\w*|fisio\w*|musico\w*|nutri\w*)\b/,
  /\b(agend\w*|marcar|remarc\w*|vaga\w*|horario\w*|disponivel|disponibilidade|consulta\w*|avaliacao)\b/,
];
const TIMEBOUND = /\d|\b(hoje|amanha|semana|segunda|terca|quarta|quinta|sexta|sabado|domingo|feriado)\b/;

function blockedStrong(normalized: string, rawText: string): boolean {
  if ((rawText.match(/\?/g) ?? []).length > 1) return true;
  return STRONG.some((re) => re.test(normalized));
}

function blockedTopical(normalized: string): boolean {
  return TOPICAL.some((re) => re.test(normalized));
}

function containsPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  if (!normalizedPhrase) return false;
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}

const COVERAGE_VERB = /\b(atend\w*|aceit\w*|trabalh\w*|cobr\w*|funciona com)\b/;
// Frase INTEIRA e específica ("quais planos vocês atendem?"). Nada de casar por
// palavras soltas: "qual o convênio Bradesco?" não pode listar os nossos.
const LIST_QUESTION = [
  /^(quais|que) (planos|convenios)( de saude)?( voces| a clinica)?( atendem| aceitam| trabalham com)?$/,
  /^(voces )?(atendem|aceitam) (quais|que) (planos|convenios)( de saude)?$/,
  /^(quais|que) (planos|convenios)( de saude)? (sao )?(atendidos|aceitos)$/,
];

export function matchFaqRule(text: string, data: FaqRuleData): FaqRuleMatch | null {
  const normalized = normalizeForRules(text);
  if (!normalized) return null;
  const tokens = normalized.split(" ");
  if (tokens.length > MAX_TOKENS) return null;
  if (blockedStrong(normalized, text)) return null;

  const conveniosAllowed = !blockedTopical(normalized) && !TIMEBOUND.test(normalized);

  // 1. "Vocês atendem <convênio>?" — exatamente UM convênio citado.
  if (conveniosAllowed && COVERAGE_VERB.test(normalized)) {
    const named = data.insurers.filter((name) => containsPhrase(normalized, normalizeForRules(name)));
    if (named.length === 1) {
      return {
        intent: "faq_regra_convenio",
        reply:
          `Sim, atendemos o convênio *${named[0]}*! 💙\n\n` +
          "Para iniciar, é só responder *AGENDAR* que já te ajudamos por aqui. " +
          "Vamos precisar da *carteirinha do plano* (foto frente e verso) e do número do cartão — " +
          "a guia a gente providencia a autorização. 🧩",
      };
    }
    if (named.length > 1) return null;
  }

  // 2. "Quais planos vocês atendem?"
  if (conveniosAllowed && LIST_QUESTION.some((re) => re.test(normalized)) && data.insurers.length > 0) {
    const list = data.insurers.map((n) => `• ${n}`).join("\n");
    return {
      intent: "faq_regra_lista_convenios",
      reply:
        `Atendemos os seguintes convênios: 💙\n${list}\n\n` +
        "Para iniciar o atendimento, é só responder *AGENDAR* que a gente te ajuda por aqui. 🧩",
    };
  }

  // 3. Palavra-chave cadastrada pelo gestor em `clinic_faq` — só se UMA pergunta casar.
  if (TIMEBOUND.test(normalized)) return null;
  const hits = data.faq.filter((entry) =>
    entry.keywords.some((k) => {
      const nk = normalizeForRules(k);
      return nk.length >= 5 && containsPhrase(normalized, nk);
    }),
  );
  if (hits.length === 1 && hits[0].answer.trim()) {
    return { intent: "faq_regra_faq", reply: hits[0].answer.trim() };
  }

  return null;
}
