// Catálogo de itens do ADL (Menezes), transcrito da planilha "ADL.xlsx" (aba ADL, B30:F81) usada pela clínica.
// 10 faixas etárias, 4 itens de Linguagem Receptiva e 4 de Linguagem Expressiva por faixa (40 + 40 itens).
import type { FonoBand } from "./types";

export const ADL_LABEL = "ADL — Avaliação do Desenvolvimento da Linguagem";
export const ADL_RECEPTIVE_LABEL = "Linguagem Receptiva";
export const ADL_EXPRESSIVE_LABEL = "Linguagem Expressiva";

/**
 * ADL!G88 soma `COUNTIF(F42:F45,"0")` duas vezes no total de incorretas da
 * Linguagem Expressiva — um erro de fórmula da planilha original, mantido
 * de propósito (decisão do usuário) em lib/fono-instruments/scoring.ts via
 * `AdlScoringOptions.doubleCountExpressiveBandKey`. A faixa afetada é
 * "2 anos até 2 anos e 5 meses" (a 3ª faixa, chave "b3"). O ADL-2 não tem
 * esse bug.
 */
export const ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY = "b3";

export const ADL_BANDS: FonoBand[] = [
  {
    key: "b1",
    label: "12 a 17 meses",
    receptive: [
      { key: "lr-1", num: 1, text: "Mantém a atenção (por dois minutos)" },
      { key: "lr-2", num: 2, text: "Compreende ordens simples com pistas gestuais" },
      { key: "lr-3", num: 3, text: "Identifica objetos familiares" },
      { key: "lr-4", num: 4, text: "Identifica figuras" },
    ],
    expressive: [
      { key: "le-1", num: 1, text: "Produz sons silábicos variados (faz combinação de sons)" },
      { key: "le-2", num: 2, text: "Possui vocabulário de pelo menos uma palavra" },
      { key: "le-3", num: 3, text: "Comunica-se de forma não verbal, usando gestos, chamando atenção para si ou apontando para um objeto ou pessoa" },
      { key: "le-4", num: 4, text: "Imita uma palavra" },
    ],
  },
  {
    key: "b2",
    label: "1 ano e 6 m até 1 ano e 11 m",
    receptive: [
      { key: "lr-5", num: 5, text: "Compreende ordens simples sem pistas gestuais" },
      { key: "lr-6", num: 6, text: "Identifica figuras" },
      { key: "lr-7", num: 7, text: "Identifica partes do corpo em si próprio" },
      { key: "lr-8", num: 8, text: "Compreende ações dentro de um contexto" },
    ],
    expressive: [
      { key: "le-5", num: 5, text: "Nomeia objetos" },
      { key: "le-6", num: 6, text: "Produz seqüência de palavras soltas" },
      { key: "le-7", num: 7, text: "Compreende relação de posse" },
      { key: "le-8", num: 8, text: "Adquiriu vocabulário de pelo menos 10 palavras diferentes" },
    ],
  },
  {
    key: "b3",
    label: "2 anos até 2 anos e 5 meses",
    receptive: [
      { key: "lr-9", num: 9, text: "Compreende conceitos espaciais" },
      { key: "lr-10", num: 10, text: "Compreende alguns pronomes" },
      { key: "lr-11", num: 11, text: "Compreende conceitos de quantidade" },
      { key: "lr-12", num: 12, text: "Reconhece a ação nas figuras" },
    ],
    expressive: [
      { key: "le-9", num: 9, text: "Usa entonação adequada para fazer pergunta" },
      { key: "le-10", num: 10, text: "Combina duas ou mais palavras na fala espontânea" },
      { key: "le-11", num: 11, text: "Nomeia figuras" },
      { key: "le-12", num: 12, text: "Reconhece e nomeia ação em figuras" },
    ],
  },
  {
    key: "b4",
    label: "2 anos e 6 meses até 2 anos e 11 meses",
    receptive: [
      { key: "lr-13", num: 13, text: "Compreende o uso dos objetos" },
      { key: "lr-14", num: 14, text: "Compreende os conceitos dos adjetivos" },
      { key: "lr-15", num: 15, text: "Compreende relações parte/todo" },
      { key: "lr-16", num: 16, text: "Identifica figuras" },
    ],
    expressive: [
      { key: "le-13", num: 13, text: "Responde a questões sobre si mesmo" },
      { key: "le-14", num: 14, text: "Vocabulário" },
      { key: "le-15", num: 15, text: "Emprega palavras que indicam posse" },
      { key: "le-16", num: 16, text: "Responde a questões que contenham: “o quê”, “onde” e questões que as respostas são sim/não" },
    ],
  },
  {
    key: "b5",
    label: "3 anos até 3 anos e 5 meses",
    receptive: [
      { key: "lr-17", num: 17, text: "Compreende conceitos de adjetivos" },
      { key: "lr-18", num: 18, text: "Compreende perguntas negativas" },
      { key: "lr-19", num: 19, text: "Categoriza" },
      { key: "lr-20", num: 20, text: "Mostra partes do corpo" },
    ],
    expressive: [
      { key: "le-17", num: 17, text: "Compreende e responde questões sobre si" },
      { key: "le-18", num: 18, text: "Fala sobre o uso de um objeto" },
      { key: "le-19", num: 19, text: "Descreve ações diante de uma figura" },
      { key: "le-20", num: 20, text: "Compreende e responde a questões com o pronome interrogativo “que”" },
    ],
  },
  {
    key: "b6",
    label: "3 anos e 6 meses até 3 anos e 11 meses",
    receptive: [
      { key: "lr-21", num: 21, text: "Compara objetos" },
      { key: "lr-22", num: 22, text: "Faz deduções" },
      { key: "lr-23", num: 23, text: "Vocabulário receptivo" },
      { key: "lr-24", num: 24, text: "Compreende pronome pessoal" },
    ],
    expressive: [
      { key: "le-21", num: 21, text: "Habilidade para solucionar e responder a questões sobre situações problemas" },
      { key: "le-22", num: 22, text: "Habilidade para definir objetos" },
      { key: "le-23", num: 23, text: "Vocabulário expressivo" },
      { key: "le-24", num: 24, text: "Adquiriu plural regular" },
    ],
  },
  {
    key: "b7",
    label: "4 anos até 4 anos e 5 meses",
    receptive: [
      { key: "lr-25", num: 25, text: "Compreende conceitos espaciais (conjunções, advérbios)" },
      { key: "lr-26", num: 26, text: "Compreende conceitos de tempo" },
      { key: "lr-27", num: 27, text: "Compreende ordens complexas" },
      { key: "lr-28", num: 28, text: "Identifica cores" },
    ],
    expressive: [
      { key: "le-25", num: 25, text: "Usa palavras que expressam relação espacial" },
      { key: "le-26", num: 26, text: "Memória para sentença" },
      { key: "le-27", num: 27, text: "Categorização de nomes" },
      { key: "le-28", num: 28, text: "Emprega adjetivos para descrever pessoas e objetos" },
    ],
  },
  {
    key: "b8",
    label: "4 anos e 6 m. até 4 anos e 11 m.",
    receptive: [
      { key: "lr-29", num: 29, text: "Compreende conceitos de adjetivos" },
      { key: "lr-30", num: 30, text: "Compreende os sufixos nominais" },
      { key: "lr-31", num: 31, text: "Compreende nome + 2 adjetivos" },
      { key: "lr-32", num: 32, text: "Compreende conceitos de quantidade" },
    ],
    expressive: [
      { key: "le-29", num: 29, text: "Nomeia cores" },
      { key: "le-30", num: 30, text: "Construção de sentenças" },
      { key: "le-31", num: 31, text: "Responde a questões que utilizam o pronome interrogativo “quando”" },
      { key: "le-32", num: 32, text: "Responde a questões sobre a sua rotina diária" },
    ],
  },
  {
    key: "b9",
    label: "5 anos até 5 anos e 11 meses",
    receptive: [
      { key: "lr-33", num: 33, text: "Compreende sentenças na voz passiva" },
      { key: "lr-34", num: 34, text: "Compreende conceitos de quantidade" },
      { key: "lr-35", num: 35, text: "Identifica diferenças" },
      { key: "lr-36", num: 36, text: "Compreende conceitos de seqüência de tempo" },
    ],
    expressive: [
      { key: "le-33", num: 33, text: "Adquiriu palavras que expressam quantidade" },
      { key: "le-34", num: 34, text: "Habilidade para buscar palavras dentro de uma categoria" },
      { key: "le-35", num: 35, text: "Habilidade para solucionar e responder a questões sobre situações problemas" },
      { key: "le-36", num: 36, text: "Conta uma estória diante de gravuras em quadrinhos" },
    ],
  },
  {
    key: "b10",
    label: "6 anos até 6 anos e 11 meses",
    receptive: [
      { key: "lr-37", num: 37, text: "Faz cálculo de soma e subtração até 5" },
      { key: "lr-38", num: 38, text: "Compreende conceito de velocidade" },
      { key: "lr-39", num: 39, text: "Relação espacial" },
      { key: "lr-40", num: 40, text: "Relação temporal" },
    ],
    expressive: [
      { key: "le-37", num: 37, text: "Habilidade para definir palavras" },
      { key: "le-38", num: 38, text: "Completa analogias" },
      { key: "le-39", num: 39, text: "Faz derivação de palavra (acrescenta sufixos)" },
      { key: "le-40", num: 40, text: "Memória" },
    ],
  },
];
