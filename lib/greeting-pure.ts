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
