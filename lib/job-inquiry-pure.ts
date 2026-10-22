// lib/job-inquiry-pure.ts
// Desambiguação PURA de "vaga" no WhatsApp da clínica. Em português a mesma
// palavra cobre dois assuntos opostos:
//   - vaga de EMPREGO ("vocês têm vaga pra psicóloga?", "posso mandar meu
//     currículo?") → resposta única mandando para o Trabalhe Conosco do site,
//     e o atendimento automático daquela conversa é DESLIGADO;
//   - vaga de AGENDAMENTO ("tem vaga pra avaliação essa semana?", "abriu vaga
//     na terça?") → é o fluxo principal da clínica e não pode, em hipótese
//     alguma, cair na resposta de emprego e silenciar uma família.
//
// Por isso a decisão do modelo (intent="emprego") só vale se a mensagem
// tiver alguma marca EXPLÍCITA de trabalho. Sem isso, o bot não manda a
// mensagem de emprego — errar para o lado do atendimento é barato, errar para
// o lado de calar uma família não é.
//
// Sem import com alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/job-inquiry-pure.test.ts).

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Funções/profissões que só aparecem em candidatura quando vêm junto de
 * "vaga"/"precisando"/"contratam". Sozinhas NÃO bastam: "fisioterapeuta" pode ser
 * "a fisioterapeuta indicou", "atendente" pode ser "quero falar com atendente". */
const JOB_ROLES =
  "atendente|recepcionista|fisioterap\\w*|educacao fisica|professor\\w*|psicolog\\w*|fonoaudiolog\\w*|" +
  "terapeuta ocupacional|pedagog\\w*|psicopedagog\\w*|nutricionista|mediador\\w*|vendedor\\w*|" +
  "estagiari\\w*|profission\\w*|acompanhante terapeutic\\w*";

/**
 * Marcas explícitas de candidatura/trabalho. "vaga" sozinho NÃO entra aqui —
 * é justamente a palavra ambígua. "vaga de emprego", "vaga de trabalho" e
 * "vaga para trabalhar" entram porque o complemento desfaz a ambiguidade.
 */
const JOB_PATTERNS: RegExp[] = [
  /\bcurriculo?s?\b/,
  /\bcv\b/,
  /\bemprego?s?\b/,
  /\bcontrat(a|am|ando|acao|ar|acoes)\b/,
  /\bestagi(o|os|ario|aria|arios|arias)\b/,
  /\brecrutamento\b/,
  /\bselecao\b|\bprocesso seletivo\b/,
  /\brh\b|\brecursos humanos\b/,
  /\btrabalhe conosco\b/,
  /\btrabalh(ar|o|ando)\b.{0,20}\b(com voces|ai|na clinica|no instituto|contigo)\b/,
  /\b(quero|gostaria|posso|como faco para)\b.{0,30}\btrabalh(ar|o)\b/,
  /\bvaga(s)?\b.{0,15}\b(de |para |pra )?(emprego|trabalho|trabalhar|estagio|psicolog|fonoaudiolog|terapeuta ocupacional|recepcionista|pedagog)/,
  // Funções dos anúncios reais (out/2026): "vaga de atendente", "vaga para
  // fisioterapeuta", "vagas abertas para profissionais da saúde".
  new RegExp(String.raw`\bvaga(s)?\b.{0,25}\b(de |para |pra |p )?(${JOB_ROLES})\b`),
  // "sou fisioterapeuta e gostaria de me candidatar", "vim pela proposta de contratação"
  /\bcandidat(ar|ura|uras|o|a|os|as)\b/,
  /\bproposta de contratacao\b/,
  // "estão precisando de professor de educação física?", "contratam estagiária de fisio?"
  new RegExp(String.raw`\b(precisando|precisam|precisa|contratam|contratando|contrata)\b.{0,25}\b(${JOB_ROLES})\b`),
  /\bsou\b.{0,40}\b(formad|recem[- ]formad|profissional)\b.{0,40}\b(vaga|oportunidade|trabalh)/,
  /\boportunidade(s)?\b.{0,15}\b(de )?(trabalho|emprego|estagio)\b/,
];

/**
 * A mensagem fala EXPLICITAMENTE de trabalho/candidatura? Só quando isto é
 * verdade a resposta "não recebemos currículos" pode ser enviada e a conversa
 * encerrada.
 */
export function hasExplicitJobSignal(text: string): boolean {
  const normalized = normalize(text);
  return JOB_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Subconjunto CONSERVADOR de `JOB_PATTERNS`, seguro para responder SEM IA e
 * desligar o bot da conversa. Ficam de fora as marcas que também aparecem em
 * frase de família: "quero contratar as sessões", "quero trabalhar a fala do
 * meu filho", "trabalhar com vocês o desenvolvimento dele", "a estagiária
 * atende?", "qual o currículo da fono?", "vaga para terapeuta ocupacional"
 * (horário de atendimento). Essas seguem pelo agente de FAQ, que decide com
 * o contexto da conversa.
 */
/** Subconjunto de JOB_ROLES que uma família nunca usa junto de "vaga":
 * ninguém pede "vaga para atendente" querendo horário para o filho. Terapias
 * (fono, TO, psicologia) ficam de fora de propósito. */
const JOB_ROLES_STRONG =
  "atendente|recepcionista|fisioterapeut\\w*|professor\\w*|educacao fisica|nutricionista|mediador\\w*|" +
  "vendedor\\w*|estagiari\\w*|profission\\w*";

const STRONG_JOB_PATTERNS: RegExp[] = [
  /\bcurriculo?s?\b(?!\s+d[aeo]s?\b)/,
  /\bcv\b/,
  /\bemprego?s?\b/,
  /\bestagios?\b/,
  /\bcontratando\b/,
  /\bprocesso seletivo\b|\brecrutamento\b/,
  /\btrabalhe conosco\b/,
  /\boportunidade(s)?\b.{0,15}\b(de )?(trabalho|emprego|estagio)\b/,
  /\bfazer parte d(a|o) (nossa |sua )?(equipe|time)\b/,
  // "me candidatar", "candidatura para a vaga de atendente" — ninguém se
  // candidata a um horário de atendimento.
  /\bcandidat(ar|ura|uras)\b/,
  /\bproposta de contratacao\b/,
  // "vaga de atendente", "vaga para fisioterapeuta", "vaga p/ professor de
  // educação física": a função desfaz a ambiguidade de "vaga". Fica de fora
  // "vaga para terapeuta ocupacional" (pode ser horário de TO) — ver
  // JOB_ROLES_STRONG.
  new RegExp(String.raw`\bvaga(s)?\b.{0,20}\b(de |para |pra |p )?(${JOB_ROLES_STRONG})\b`),
];

/** A mensagem é candidatura/trabalho SEM ambiguidade (ver `STRONG_JOB_PATTERNS`)? */
export function hasStrongJobSignal(text: string): boolean {
  const normalized = normalize(text);
  return STRONG_JOB_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Resposta fixa (sem IA) para currículo/vaga de emprego. Link DIRETO da
 * página de candidatura (o rótulo "Trabalhe Conosco" fica no topo do site e
 * 6 candidatos em outubro disseram não achar) e o e-mail como alternativa. */
export const JOB_INQUIRY_REPLY =
  "Olá! 💙 Agradecemos o seu interesse em fazer parte do *FaçaAmigos*!\n\n" +
  "Por aqui no WhatsApp não recebemos currículos nem tratamos de vagas de trabalho. 🙏\n\n" +
  "Para se candidatar, preencha o formulário da página *Trabalhe Conosco* (currículo em PDF):\n" +
  "https://institutofacaamigos.com.br/trabalhe-conosco\n\n" +
  "Se o link não abrir, envie o currículo para institutofacaamigos@gmail.com. Boa sorte! 🌱";

/** Quando o modelo diz "emprego" mas a mensagem não tem marca explícita de
 * trabalho ("Vaga está disponível?", "Em busca de uma oportunidade"), o bot
 * pergunta em vez de cair no fallback de boas-vindas (era o que acontecia em
 * ~40 conversas de outubro/2026). */
export const JOB_AMBIGUOUS_REPLY =
  "Só pra eu te direcionar certinho 💙: você procura *vaga de trabalho* na clínica ou *horário de atendimento* para uma criança?\n\n" +
  "Se for atendimento, me conta o plano de saúde e a terapia que procura. Se for trabalho, respondo em seguida.";
