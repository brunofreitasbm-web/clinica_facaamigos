// lib/human-request-pure.ts
// Regra PURA: o contato está PEDINDO para falar com uma pessoa? Sem import com alias
// `@/` para rodar em `node --test --experimental-strip-types`
// (tests/human-request-pure.test.ts).
//
// Complementa `parseExitCommand` (lib/anamnesis-bot-pure.ts), que só reconhece a
// mensagem INTEIRA curta ("atendente", "quero falar com atendente"). Aqui entra a
// frase solta: "queria falar com alguém sobre a guia da minha filha", "me liga",
// "não quero falar com robô". Sempre exige verbo/intenção de pedido — citar a
// palavra "atendente" não basta ("o atendente me ajudou muito" não escala), e o
// que for ambíguo continua indo para a IA como antes.

function normalize(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PERSON =
  "(alguem|pessoa|pessoas|humano|humana|atendente|atendentes|recepcao|recepcionista|secretaria|equipe|gente de verdade|funcionario|funcionaria|responsavel)";

const REQUEST_PATTERNS: RegExp[] = [
  // "quero/queria/gostaria/preciso/posso ... falar|conversar ... com ... <pessoa>"
  new RegExp(
    `\\b(quero|queria|gostaria|gostariamos|preciso|precisava|precisamos|posso|podemos|consigo|prefiro|da pra|tem como)\\b.{0,30}\\b(falar|conversar|trocar uma ideia|tratar)\\b.{0,25}\\b(com|c)\\b.{0,15}\\b${PERSON}\\b`,
  ),
  // "falar com alguém/atendente..." no início ou após saudação
  new RegExp(`^(oi |ola |bom dia |boa tarde |boa noite )*(falar|conversar) (com|c) (um |uma |o |a )?${PERSON}\\b`),
  // "me passa/transfere/encaminha/coloca para um atendente"
  new RegExp(`\\b(me )?(passa|passe|passar|transfere|transfira|transferir|encaminha|encaminhe|encaminhar|coloca|coloque|colocar|chama|chame|chamar|manda|mande)\\b.{0,15}\\b(para|pra|com|um|uma|o|a)\\b.{0,10}\\b${PERSON}\\b`),
  // "alguém pode me ligar/responder/atender/ajudar"
  /\b(alguem|alguma pessoa)\b.{0,20}\b(pode|poderia|consegue|conseguiria)\b.{0,15}\b(me )?(ligar|responder|atender|ajudar|retornar)\b/,
  // "me liga", "podem me ligar", "retornem a ligação"
  /\b(me )?(liga|ligue|ligar|ligam|retorna|retorne|retornem)\b.{0,15}\b(para mim|pra mim|a ligacao|ligacao|por favor|pfv|me)\b/,
  /^(me liga|me ligue|pode me ligar|podem me ligar)\b/,
  // "não quero robô/bot/máquina", "chega de robô", "quero falar com gente"
  /\b(nao quero|nao gosto|chega de|cansei d[eo]|odeio)\b.{0,15}\b(robo|bot|maquina|automatico|mensagem automatica)\b/,
  /\b(falar|conversar) com (gente|alguem de verdade|uma pessoa de verdade)\b/,
  // "atendente por favor", "chama um atendente"
  new RegExp(`\\b${PERSON}\\b.{0,12}\\b(por favor|pfv|pf|urgente|agora)\\b`),
];

// Elogio/relato sobre atendimento já recebido: nunca é pedido.
const PAST_EXPERIENCE = /\b(me atendeu|me atendeu bem|me ajudou|fui atendid[oa]|foi atendid[oa]|atendimento foi|atendimento e|obrigad[oa] (ao|a|pelo|pela))\b/;

/** O texto pede, com intenção clara, para falar com uma pessoa da equipe? */
export function detectHumanRequest(raw: string | null | undefined): boolean {
  const text = normalize(raw);
  if (!text) return false;
  const hasRequestVerb = /\b(quero|queria|gostaria|gostariamos|preciso|precisava|precisamos|posso|podemos|consigo|prefiro|pode|poderia|chama|chame|passa|passe|transfere|encaminha|liga|ligue)\b/.test(text);
  if (PAST_EXPERIENCE.test(text) && !hasRequestVerb) return false;
  return REQUEST_PATTERNS.some((re) => re.test(text));
}
