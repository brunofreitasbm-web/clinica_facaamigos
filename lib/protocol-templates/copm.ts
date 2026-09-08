/**
 * Template genérico de desempenho ocupacional autorreferido com estrutura
 * tipo COPM.
 *
 * A ESTRUTURA (3 áreas ocupacionais com 3 subáreas cada, escala de 1 a 10
 * para desempenho e satisfação, até 5 problemas priorizados) é reproduzida a
 * partir de descrições públicas. O TEXTO DE CADA ITEM É ORIGINAL — nada foi
 * copiado ou parafraseado do manual. Não usar a marca como nome do produto.
 *
 * Escala: 1 (não consegue / nada satisfeito) a 10 (faz muito bem / muito
 * satisfeito). O valor 0 não é exibido.
 *
 * Fontes (estrutura):
 * - https://www.sralab.org/rehabilitation-measures/canadian-occupational-performance-measure
 */
import type { ProtocolTemplate } from "./types";

export const copmTemplate: ProtocolTemplate = {
  name: "copm",
  displayName: "Desempenho ocupacional autorreferido (estrutura tipo COPM, genérico)",
  version: "1.0",
  scale: {
    max: 10,
    min: 1,
    labels: {
      1: "1 — não consegue / nada satisfeito",
      2: "2",
      3: "3",
      4: "4",
      5: "5 — médio",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      10: "10 — faz muito bem / muito satisfeito",
    },
  },
  contentLicense: "original",
  sources: [
    "https://www.sralab.org/rehabilitation-measures/canadian-occupational-performance-measure",
  ],
  notes:
    "Entrevista semiestruturada: a família ou o paciente identifica até 5 problemas ocupacionais prioritários e pontua cada um de 1 a 10 em desempenho e em satisfação. Este template pontua o DESEMPENHO por subárea; registrar a satisfação e os problemas nomeados nas observações da aplicação. Reavaliar após a intervenção; mudança de 2 pontos ou mais é considerada clinicamente relevante.",
  domains: [
    {
      domain: "Autocuidado",
      items: [
        {
          code: "AC-01",
          description:
            "Desempenho em cuidado pessoal: vestir-se, alimentar-se, banho e higiene conforme o esperado para a idade.",
        },
        {
          code: "AC-02",
          description:
            "Desempenho em mobilidade funcional: deslocar-se em casa, na escola e em transferências como sentar e levantar.",
        },
        {
          code: "AC-03",
          description:
            "Desempenho em participação na comunidade: usar transporte, frequentar lojas, consultas e espaços públicos.",
        },
      ],
    },
    {
      domain: "Produtividade",
      items: [
        {
          code: "PR-01",
          description:
            "Desempenho em trabalho remunerado ou não remunerado: tarefas com responsabilidade, voluntariado ou pequenas funções.",
        },
        {
          code: "PR-02",
          description:
            "Desempenho em tarefas domésticas: guardar brinquedos, ajudar na mesa, organizar o próprio material.",
        },
        {
          code: "PR-03",
          description:
            "Desempenho em escola ou brincar: acompanhar atividades escolares, lição de casa e brincadeiras com propósito.",
        },
      ],
    },
    {
      domain: "Lazer",
      items: [
        {
          code: "LZ-01",
          description:
            "Desempenho em recreação tranquila: livros, desenho, jogos de mesa, música e atividades calmas.",
        },
        {
          code: "LZ-02",
          description:
            "Desempenho em recreação ativa: esportes, parque, passeios e brincadeiras que exigem movimento.",
        },
        {
          code: "LZ-03",
          description:
            "Desempenho em socialização: visitar amigos, festas, encontros familiares e conversas com pares.",
        },
      ],
    },
  ],
};

export default copmTemplate;
