// lib/greeting-pure.ts
// Saudação inicial do WhatsApp SEM IA. A maioria dos primeiros contatos é a
// mensagem pré-preenchida do botão do site ("Olá! Gostaria de informações
// sobre o FaçaAmigos...") ou um "Oi"/"Bom dia" solto — nada disso precisa de
// modelo: uma resposta fixa sai na hora (sem esperar o Gemini, que passava de
// 15s e estourava o timeout do webhook) e não gasta cota diária de IA.
//
// Só vale para mensagem que é APENAS saudação. Qualquer pergunta junto
// ("Oi, vocês atendem Unimed?") segue para o agente de FAQ.
//
// Sem import com alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/greeting-pure.test.ts).

/** Resposta padrão da primeira saudação. "AGENDAR" é gatilho real da máquina de
 * estados de anamnese (lib/twilio-anamnesis-bot.ts); o resto é texto livre,
 * que cai no agente de FAQ. */
export const INITIAL_GREETING_REPLY =
  "Olá! 💙 Boas-vindas ao *FaçaAmigos - Centro de Terapia Comportamental*! 🧩\n\n" +
  "Como podemos te ajudar hoje?\n" +
  "• Para marcar uma avaliação, responda *AGENDAR*.\n" +
  "• Ou escreva sua dúvida por aqui (planos de saúde, terapias, valores...) que já respondemos! ✨";

/** Intent gravado em `messages.intent` para a resposta fixa. */
export const INITIAL_GREETING_INTENT = "saudacao_padrao";

/** Janela em que uma resposta anterior da clínica/bot na mesma conversa
 * impede repetir as boas-vindas. */
export const GREETING_REPEAT_WINDOW_MS = 6 * 60 * 60 * 1000;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Mensagem pré-preenchida pelo botão do site (e a variação "vim pelo site").
const SITE_PREFILL =
  /^(ola|oi) (vim pelo site e )?gostaria de (mais )?informacoes sobre (o )?faca ?amigos( centro de terapia comportamental)?$/;

/**
 * Os OUTROS botões do site (institutofacaamigos.com.br) que abrem o WhatsApp
 * com texto pronto. Cada um diz o que a pessoa quer antes de ela escrever
 * qualquer coisa, então a resposta é fixa e sem IA — antes, "Quero entrar na
 * lista de espera" caía no Gemini (que não sabe o que é a lista) ou no
 * fallback de boas-vindas (em 7 conversas de set–out/2026).
 */
export type SitePrefillKind = "info" | "lista_espera" | "mapeamento" | "menor_4";

const SITE_PREFILL_LISTA_ESPERA = /^(ola|oi) quero entrar na lista de espera da clinica faca ?amigos/;
// "Acabei de fazer o Mapeamento Comportamental do(a) Arthur. Gostaria de
// conversar." e "Oi! Tenho uma dúvida sobre o Mapeamento Comportamental."
const SITE_PREFILL_MAPEAMENTO =
  /^((ola|oi) )?(acabei de fazer o mapeamento comportamental|tenho uma duvida sobre o mapeamento comportamental)/;
// "Oi! Minha criança (Arthur) tem menos de 4 anos e eu gostaria de conversar
// sobre o desenvolvimento dela." (o mapeamento do site só cobre 4–17 anos).
const SITE_PREFILL_MENOR_4 = /^(ola|oi) minha crianca .{0,60}tem menos de 4 anos/;

/** Qual botão do site gerou a mensagem, ou null se não foi um botão. */
export function detectSitePrefill(text: string): SitePrefillKind | null {
  const normalized = normalize(text);
  if (!normalized) return null;
  if (SITE_PREFILL.test(normalized)) return "info";
  if (SITE_PREFILL_LISTA_ESPERA.test(normalized)) return "lista_espera";
  if (SITE_PREFILL_MAPEAMENTO.test(normalized)) return "mapeamento";
  if (SITE_PREFILL_MENOR_4.test(normalized)) return "menor_4";
  return null;
}

/** Respostas fixas dos botões que não são a saudação genérica. Nenhuma
 * promete agenda nem manda responder AGENDAR: a situação da agenda é da
 * recepção (ou da nota "situação da agenda" do prompt, quando a conversa
 * segue para a IA). */
export const SITE_PREFILL_REPLIES: Record<Exclude<SitePrefillKind, "info">, string> = {
  lista_espera:
    "Olá! 💙 Boas-vindas ao *FaçaAmigos - Centro de Terapia Comportamental*! 🧩\n\n" +
    "Para entrar na lista de espera, me conta em uma única mensagem:\n" +
    "• nome e idade da criança;\n" +
    "• plano de saúde (ou particular);\n" +
    "• qual terapia ou avaliação você procura.\n\n" +
    "A recepção confirma a sua entrada na lista e retorna por aqui em horário comercial. ✨",
  mapeamento:
    "Olá! 💙 Que bom que você fez o *Mapeamento Comportamental*! Ele é um retrato educativo, não é um diagnóstico, " +
    "e o resultado chega também no seu e-mail. 🧩\n\n" +
    "Se quiser conversar com a nossa equipe sobre ele, me conta o nome e a idade da criança e o plano de saúde " +
    "(ou particular), que a recepção retorna por aqui em horário comercial. ✨",
  menor_4:
    "Olá! 💙 Boas-vindas ao *FaçaAmigos - Centro de Terapia Comportamental*! 🧩\n\n" +
    "Me conta em poucas palavras o que você tem observado, a idade da criança e o plano de saúde (ou particular), " +
    "que a gente te orienta por aqui. ✨",
};

/** Intent gravado em `messages.intent` para cada botão do site. */
export function sitePrefillIntent(kind: Exclude<SitePrefillKind, "info">): string {
  return `site_${kind}`;
}

// Palavras que, sozinhas, formam uma saudação ("Oi, tudo bem?", "Boa tarde",
// "Oi, muito bom dia").
const GREETING_TOKENS = new Set([
  "oi", "oii", "oiii", "ola", "olaa", "ei", "opa", "eai", "e", "ai",
  "bom", "boa", "dia", "tarde", "noite", "muito",
  "tudo", "td", "bem", "bom",
]);
const GREETING_CORE = /\b(oi+|ola+|ei|opa|eai|bom dia|boa tarde|boa noite|tudo bem|td bem)\b/;
const MAX_GREETING_TOKENS = 6;

/** A mensagem é só uma saudação (ou o texto pré-preenchido do site)? */
export function isPureGreeting(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (SITE_PREFILL.test(normalized)) return true;

  const tokens = normalized.split(" ");
  if (tokens.length > MAX_GREETING_TOKENS) return false;
  if (!tokens.every((token) => GREETING_TOKENS.has(token))) return false;
  return GREETING_CORE.test(normalized);
}
