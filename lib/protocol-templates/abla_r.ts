/**
 * Template genérico de habilidades básicas de aprendizagem com estrutura
 * tipo ABLA-R.
 *
 * A ESTRUTURA (6 níveis hierárquicos de discriminação, sequência de tentativa
 * demonstrada / guiada / independente e o critério de 8 acertos consecutivos
 * ou 8 erros acumulados) é reproduzida a partir de descrições públicas. O
 * TEXTO DE CADA ITEM É ORIGINAL — nada foi copiado ou parafraseado do manual.
 * Não usar a marca como nome do produto.
 *
 * Escala: 0 = Reprovado, 1 = Emergente, 2 = Aprovado.
 *
 * Fontes (estrutura):
 * - https://www.scielo.br/j/ptp/a/4z9sbpsbLQSXmBCCFTFPrYF/?lang=pt
 * - https://stamant.ca/wp-content/uploads/2023/01/ABLA-R-self-instructional-manual-20140630-1.pdf
 */
import type { ProtocolTemplate, ProtocolTemplateDomain } from "./types";

type LevelSpec = {
  code: string;
  domain: string;
  /** O que a criança faz na tarefa deste nível, em uma frase curta. */
  task: string;
};

const CRITERIO = "critério: 8 acertos consecutivos; encerra com 8 erros acumulados";

function buildLevel(spec: LevelSpec): ProtocolTemplateDomain {
  return {
    domain: spec.domain,
    items: [
      {
        code: `${spec.code}-DEM`,
        description: `Tentativa demonstrada: observa o avaliador ${spec.task} e mantém atenção ao modelo.`,
      },
      {
        code: `${spec.code}-GUI`,
        description: `Tentativa guiada: ${spec.task} com ajuda física do avaliador, sem resistência.`,
      },
      {
        code: `${spec.code}-IND`,
        description: `Tentativa independente: ${spec.task} sozinho (${CRITERIO}).`,
      },
    ],
  };
}

const LEVELS: LevelSpec[] = [
  {
    code: "N1",
    domain: "Nível 1 — Imitação motora",
    task: "colocar um objeto solto dentro de um único recipiente à sua frente",
  },
  {
    code: "N2",
    domain: "Nível 2 — Discriminação de posição (2 escolhas)",
    task: "colocar o objeto no recipiente que fica sempre do mesmo lado, com dois recipientes fixos",
  },
  {
    code: "N3",
    domain: "Nível 3 — Discriminação visual simples (2 escolhas)",
    task: "colocar o objeto no recipiente de cor e formato alvo, com as posições trocadas entre tentativas",
  },
  {
    code: "N4",
    domain: "Nível 4 — Pareamento por identidade visual",
    task: "colocar cada objeto no recipiente que tem a mesma cor e formato que ele",
  },
  {
    code: "N5",
    domain: "Nível 5 — Discriminação condicional visual-visual (arbitrária)",
    task: "colocar cada objeto no recipiente combinado a ele por regra, sem semelhança física entre os dois",
  },
  {
    code: "N6",
    domain: "Nível 6 — Discriminação condicional auditivo-visual",
    task: "colocar o objeto no recipiente que corresponde à palavra dita pelo avaliador",
  },
];

export const ablaRTemplate: ProtocolTemplate = {
  name: "abla_r",
  displayName: "Habilidades básicas de aprendizagem (estrutura tipo ABLA-R, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: { 0: "Reprovado", 1: "Emergente", 2: "Aprovado" },
  },
  contentLicense: "original",
  sources: [
    "https://www.scielo.br/j/ptp/a/4z9sbpsbLQSXmBCCFTFPrYF/?lang=pt",
    "https://stamant.ca/wp-content/uploads/2023/01/ABLA-R-self-instructional-manual-20140630-1.pdf",
  ],
  notes:
    "6 níveis hierárquicos; cada nível registra a tentativa demonstrada, a guiada e a independente. Aplicar os níveis em ordem e considerar o nível mais alto aprovado como nível de aprendizagem da criança.",
  domains: LEVELS.map(buildLevel),
};

export default ablaRTemplate;
