/**
 * Template genérico de perfil de comunicação por níveis com estrutura tipo
 * Matriz de Comunicação.
 *
 * A ESTRUTURA (7 níveis de desenvolvimento comunicativo cruzados com 4
 * razões para comunicar: recusar, obter, social e informação) é reproduzida a
 * partir de descrições públicas. O TEXTO DE CADA ITEM É ORIGINAL — nada foi
 * copiado ou parafraseado do manual. Não usar a marca como nome do produto.
 *
 * Escala: 0 = Não usado, 1 = Emergente, 2 = Dominado.
 *
 * Fontes (estrutura):
 * - https://communicationmatrix.org/uploads/pdfs/handbook.pdf
 */
import type { ProtocolTemplate, ProtocolTemplateDomain } from "./types";

type LevelSpec = {
  code: string;
  domain: string;
  recusar: string;
  obter: string;
  social: string;
  informacao: string;
};

function buildLevel(spec: LevelSpec): ProtocolTemplateDomain {
  return {
    domain: spec.domain,
    items: [
      { code: `${spec.code}-REC`, description: `Recusar: ${spec.recusar}` },
      { code: `${spec.code}-OBT`, description: `Obter: ${spec.obter}` },
      { code: `${spec.code}-SOC`, description: `Social: ${spec.social}` },
      { code: `${spec.code}-INF`, description: `Informação: ${spec.informacao}` },
    ],
  };
}

const LEVELS: LevelSpec[] = [
  {
    code: "L1",
    domain: "Nível I — Comportamento pré-intencional",
    recusar: "mostra desconforto com choro, tensão corporal ou afastamento diante de algo desagradável, sem dirigir a outra pessoa.",
    obter: "mostra contentamento com relaxamento, sons suaves ou movimentos quando algo agradável acontece, sem dirigir a ninguém.",
    social: "reage à voz ou ao toque de pessoas familiares com mudança de expressão ou de atividade corporal.",
    informacao: "mostra atenção ou reação a sons e imagens novos, sem procurar quem os produz. Nível não aplicável para informar.",
  },
  {
    code: "L2",
    domain: "Nível II — Comportamento intencional",
    recusar: "afasta o corpo, vira o rosto ou empurra o objeto indesejado, mas sem olhar para o cuidador.",
    obter: "estende a mão ou se move em direção ao objeto desejado, tentando alcançá-lo por conta própria.",
    social: "olha ou se move em direção a pessoas para manter contato, ainda sem comunicar um pedido específico.",
    informacao: "explora objetos e ambientes com o olhar e as mãos para descobrir o que acontece. Nível não aplicável para informar.",
  },
  {
    code: "L3",
    domain: "Nível III — Comunicação não convencional",
    recusar: "empurra a mão do adulto, joga o objeto ou vocaliza em protesto olhando para o cuidador.",
    obter: "leva a mão do adulto até o objeto, puxa a pessoa ou vocaliza olhando alternadamente entre pessoa e objeto.",
    social: "toca, puxa ou vocaliza para chamar a atenção do adulto e mantê-lo por perto durante a interação.",
    informacao: "dirige o olhar e sons ao adulto diante de algo novo, esperando uma resposta. Nível não aplicável para informar.",
  },
  {
    code: "L4",
    domain: "Nível IV — Comunicação convencional",
    recusar: "balança a cabeça, afasta o objeto com a mão aberta ou faz sinal de não dirigido ao cuidador.",
    obter: "aponta para o objeto desejado, entrega um recipiente para ser aberto ou faz gesto de dar-me.",
    social: "acena, oferece objetos, pede colo com os braços ou inicia brincadeiras de esconder olhando para o adulto.",
    informacao: "aponta ou mostra algo interessante ao adulto para compartilhar atenção, sem querer obter o objeto.",
  },
  {
    code: "L5",
    domain: "Nível V — Símbolos concretos",
    recusar: "usa uma figura, objeto de referência ou gesto que imita a ação para indicar que não quer algo.",
    obter: "aponta figuras, entrega objetos miniatura ou usa gestos que representam o item para pedi-lo.",
    social: "usa figuras ou gestos representativos para cumprimentar, chamar alguém ou pedir uma brincadeira específica.",
    informacao: "usa figuras ou gestos representativos para comentar ou mostrar algo ao adulto sem pedir o item.",
  },
  {
    code: "L6",
    domain: "Nível VI — Símbolos abstratos",
    recusar: "diz ou sinaliza uma palavra isolada, como não ou chega, ou seleciona um símbolo escrito de recusa.",
    obter: "diz, sinaliza ou seleciona uma palavra isolada para pedir um objeto ou ação, mesmo fora de vista.",
    social: "diz ou sinaliza uma palavra isolada para cumprimentar, pedir atenção ou nomear a pessoa desejada.",
    informacao: "diz ou sinaliza uma palavra isolada para nomear algo visto, responder pergunta simples ou comentar.",
  },
  {
    code: "L7",
    domain: "Nível VII — Linguagem",
    recusar: "combina duas ou mais palavras ou símbolos para recusar, como não quero isso ou tira daqui.",
    obter: "combina duas ou mais palavras ou símbolos para pedir, como quero mais suco ou abre a porta.",
    social: "combina palavras ou símbolos para conversar, cumprimentar por nome ou convidar alguém a brincar.",
    informacao: "combina palavras ou símbolos para contar eventos, responder perguntas ou fazer perguntas ao adulto.",
  },
];

export const matrizComunicacaoTemplate: ProtocolTemplate = {
  name: "matriz_comunicacao",
  displayName: "Perfil de comunicação por níveis (estrutura tipo Matriz de Comunicação, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: { 0: "Não usado", 1: "Emergente", 2: "Dominado" },
  },
  contentLicense: "original",
  sources: ["https://communicationmatrix.org/uploads/pdfs/handbook.pdf"],
  notes:
    "7 níveis cruzados com 4 razões para comunicar (recusar, obter, social, informação). Nos níveis I a III a razão informação é registrada apenas como observação de atenção, pois informar exige comunicação intencional dirigida.",
  domains: LEVELS.map(buildLevel),
};

export default matrizComunicacaoTemplate;
