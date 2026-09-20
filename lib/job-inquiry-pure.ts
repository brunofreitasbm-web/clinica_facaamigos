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
