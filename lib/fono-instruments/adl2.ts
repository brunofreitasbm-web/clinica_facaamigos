// Catálogo de itens do ADL-2 (Menezes), transcrito da planilha "ADL--2.xlsx" (aba "LC E LE", B31:F104) usada pela clínica.
// 12 faixas etárias, quantidade irregular de itens por faixa (52 de Linguagem Compreensiva, 58 de Linguagem Expressiva).
import type { FonoBand } from "./types";

export const ADL2_LABEL = "ADL-2 — Avaliação do Desenvolvimento da Linguagem 2";
export const ADL2_RECEPTIVE_LABEL = "Linguagem Compreensiva";
export const ADL2_EXPRESSIVE_LABEL = "Linguagem Expressiva";

export const ADL2_BANDS: FonoBand[] = [
  {
    key: "b1",
    label: "1 ano a 1 ano e 5 meses",
    receptive: [
      { key: "lc-1", num: 1, text: "Atenção visual" },
      { key: "lc-2", num: 2, text: "Atenção auditiva" },
      { key: "lc-3", num: 3, text: "Vocabulário compreensivo. Identifica objetos familiares" },
      { key: "lc-4", num: 4, text: "Compreende pedidos verbais simples com pistas gestuais" },
    ],
    expressive: [
      { key: "le-1", num: 1, text: "Participa de brincadeiras com outra pessoa pelo período de 1 a 2 minutos" },
      { key: "le-2", num: 2, text: "Comunica-se de forma gestual" },
      { key: "le-3", num: 3, text: "A criança vocaliza sem que movimentos de pernas e de braços acompanhem a emissão dos sons" },
      { key: "le-4", num: 4, text: "Emite sequências de duas sílabas" },
      { key: "le-5", num: 5, text: "Tem vocabulário de pelo menos uma palavra" },
      { key: "le-6", num: 6, text: "Faz turnos durante uma brincadeira" },
      { key: "le-7", num: 7, text: "Imita uma variedade de sons (fonemas)" },
    ],
  },
  {
    key: "b2",
    label: "1 ano e 6 meses a 1 ano e 11 meses",
    receptive: [
      { key: "lc-5", num: 5, text: "Vocabulário receptivo. Identifica figuras de objetos" },
      { key: "lc-6", num: 6, text: "Compreende ordens simples com dois pedidos" },
      { key: "lc-7", num: 7, text: "Compreende palavras inibitórias" },
      { key: "lc-8", num: 8, text: "Compreende verbos dentro de um contexto" },
    ],
    expressive: [
      { key: "le-8", num: 8, text: "Comunicação da criança através de vocalizações e de gestos para obter um objeto" },
      { key: "le-9", num: 9, text: "Imita uma palavra" },
      { key: "le-10", num: 10, text: "Produz sequências de palavras" },
      { key: "le-11", num: 11, text: "Tem vocabulário expressivo (espontâneo) de cinco a dez palavras" },
      { key: "le-12", num: 12, text: "A criança fala sequência de palavras sem significado com entonação semelhante a do adulto (jargão)" },
    ],
  },
  {
    key: "b3",
    label: "2 anos a 2 anos e 5 meses",
    receptive: [
      { key: "lc-9", num: 9, text: "Usa apropriadamente objetos familiares enquanto brinca" },
      { key: "lc-10", num: 10, text: "Identifica partes do corpo em si ou na boneca" },
      { key: "lc-11", num: 11, text: "Compreende relação espacial" },
      { key: "lc-12", num: 12, text: "Compreende alguns pronomes" },
      { key: "lc-13", num: 13, text: "Reconhece a ação nas figuras" },
    ],
    expressive: [
      { key: "le-13", num: 13, text: "A criança usa palavras com intenção de se comunicar" },
      { key: "le-14", num: 14, text: "Combina duas ou mais palavras com significado" },
      { key: "le-15", num: 15, text: "Nomeia figuras" },
      { key: "le-16", num: 16, text: "Comunica-se mais por palavras do que por gestos" },
    ],
  },
  {
    key: "b4",
    label: "2 anos e 6 meses a 2 anos e 11 meses",
    receptive: [
      { key: "lc-14", num: 14, text: "Compreende os pronomes “mim”, “seu”, “minha”" },
      { key: "lc-15", num: 15, text: "Compreende o uso dos objetos" },
      { key: "lc-16", num: 16, text: "Compreende os conceitos dos adjetivos" },
    ],
    expressive: [
      { key: "le-17", num: 17, text: "Combina três ou quatro palavras na fala espontânea" },
      { key: "le-18", num: 18, text: "Compreende e responde com substantivo indicando posse" },
      { key: "le-19", num: 19, text: "Vocabulário expressivo" },
    ],
  },
  {
    key: "b5",
    label: "3 anos a 3 anos e 5 meses",
    receptive: [
      { key: "lc-17", num: 17, text: "Compreende relações parte/todo" },
      { key: "lc-18", num: 18, text: "Compreende conceitos de quantidade" },
      { key: "lc-19", num: 19, text: "Identifica cores" },
      { key: "lc-20", num: 20, text: "Identifica categorias de objetos em figuras" },
    ],
    expressive: [
      { key: "le-20", num: 20, text: "Usa a forma de verbo no gerúndio" },
      { key: "le-21", num: 21, text: "Compreende e responde a questões com: “o que” substantivo; advérbio interrogativo \"onde\" e de negação “não”" },
      { key: "le-22", num: 22, text: "Nomeia cores" },
      { key: "le-23", num: 23, text: "Usa diferentes combinações de palavras para se expressar" },
    ],
  },
  {
    key: "b6",
    label: "3 anos e 6 meses a 3 anos e 11 meses",
    receptive: [
      { key: "lc-21", num: 21, text: "Compreende conceito de quantidade" },
      { key: "lc-22", num: 22, text: "Compreende pronomes pessoais" },
      { key: "lc-23", num: 23, text: "Faz deduções" },
      { key: "lc-24", num: 24, text: "Compreende o conceito de subir" },
      { key: "lc-25", num: 25, text: "Compreende questões com o pronome interrogativo “que”" },
    ],
    expressive: [
      { key: "le-24", num: 24, text: "Usa palavras que expressam relação espacial" },
      { key: "le-25", num: 25, text: "Conceito de quantidade" },
      { key: "le-26", num: 26, text: "Habilidade para solucionar e responder a questões sobre situações do cotidiano" },
      { key: "le-27", num: 27, text: "Descreve ações em uma sequência de figuras" },
    ],
  },
  {
    key: "b7",
    label: "4 anos a 4 anos e 5 meses",
    receptive: [
      { key: "lc-26", num: 26, text: "Compreende perguntas negativas" },
      { key: "lc-27", num: 27, text: "Conceito de exclusão e inclusão" },
      { key: "lc-28", num: 28, text: "Compreende conceitos de tempo" },
      { key: "lc-29", num: 29, text: "Compreende conceitos de adjetivos" },
      { key: "lc-30", num: 30, text: "Compreende conceitos espaciais" },
    ],
    expressive: [
      { key: "le-28", num: 28, text: "Responde a perguntas sobre as suas atividades na escola (no colégio)" },
      { key: "le-29", num: 29, text: "Habilidade para descrever o uso de objetos" },
      { key: "le-30", num: 30, text: "Compreende questões com o advérbio de lugar “onde”" },
      { key: "le-31", num: 31, text: "Usa pronome possessivo" },
      { key: "le-32", num: 32, text: "Expressa quantidade" },
    ],
  },
  {
    key: "b8",
    label: "4 anos e 6 meses a 4 anos e 11 meses",
    receptive: [
      { key: "lc-31", num: 31, text: "Compreende conceitos de adjetivos" },
      { key: "lc-32", num: 32, text: "Compreende analogias" },
      { key: "lc-33", num: 33, text: "Compreende orações com pronome relativo “que”" },
      { key: "lc-34", num: 34, text: "Compreende conceito de velocidade" },
    ],
    expressive: [
      { key: "le-33", num: 33, text: "Descreve sequência de figuras" },
      { key: "le-34", num: 34, text: "Plural regular" },
      { key: "le-35", num: 35, text: "Usa verbo no tempo passado" },
      { key: "le-36", num: 36, text: "Expressa quantidade" },
      { key: "le-37", num: 37, text: "Completa analogias" },
      { key: "le-38", num: 38, text: "Categorização de nomes" },
    ],
  },
  {
    key: "b9",
    label: "5 anos a 5 anos e 5 meses",
    receptive: [
      { key: "lc-35", num: 35, text: "Compreende conceitos de adjetivos comparativos" },
      { key: "lc-36", num: 36, text: "Compreende orações com adjetivos" },
      { key: "lc-37", num: 37, text: "Compreende os sufixos de gênero" },
      { key: "lc-38", num: 38, text: "Compreensão de conceito de quantidade" },
    ],
    expressive: [
      { key: "le-39", num: 39, text: "Compreende e responde a questões sobre os motivos das ações realizadas em sua rotina diária" },
      { key: "le-40", num: 40, text: "Utiliza adjetivos para descrever pessoas e objetos" },
      { key: "le-41", num: 41, text: "Compreende e descreve similaridade entre objetos" },
      { key: "le-42", num: 42, text: "Memória para repetir sentenças" },
      { key: "le-43", num: 43, text: "Descreve ações em uma sequência de figuras" },
      { key: "le-44", num: 44, text: "Responde a perguntas diante de uma sequência de figuras" },
    ],
  },
  {
    key: "b10",
    label: "5 anos e 6 meses a 5 anos e 11 meses",
    receptive: [
      { key: "lc-39", num: 39, text: "Compreende conceitos de adjetivos" },
      { key: "lc-40", num: 40, text: "Compreende palavras que indicam relação espacial" },
      { key: "lc-41", num: 41, text: "Classificação semântica" },
      { key: "lc-42", num: 42, text: "Compreende conceitos de quantidade" },
    ],
    expressive: [
      { key: "le-45", num: 45, text: "Expressa quantidade" },
      { key: "le-46", num: 46, text: "Habilidade para buscar palavras dentro de uma categoria semântica" },
      { key: "le-47", num: 47, text: "Produz uma história diante de uma figura" },
      { key: "le-48", num: 48, text: "Relembrando sentença em um contexto" },
    ],
  },
  {
    key: "b11",
    label: "6 anos a 6 anos e 5 meses",
    receptive: [
      { key: "lc-43", num: 43, text: "Relação espacial/sequência" },
      { key: "lc-44", num: 44, text: "Relação espacial" },
      { key: "lc-45", num: 45, text: "Identifica sons iniciais das palavras" },
      { key: "lc-46", num: 46, text: "Relação temporal/sequência" },
      { key: "lc-47", num: 47, text: "Relação espacial/sequência" },
    ],
    expressive: [
      { key: "le-49", num: 49, text: "Produz uma história diante de uma sequência de figuras" },
      { key: "le-50", num: 50, text: "Habilidade para definir palavras" },
      { key: "le-51", num: 51, text: "Relembrando sentenças em um contexto" },
      { key: "le-52", num: 52, text: "Produz uma história diante de uma sequência de figuras" },
      { key: "le-53", num: 53, text: "Reconta uma história com apoio visual" },
    ],
  },
  {
    key: "b12",
    label: "6 anos e 6 meses a 6 anos e 11 meses",
    receptive: [
      { key: "lc-48", num: 48, text: "Compreende conceitos de quantidade" },
      { key: "lc-49", num: 49, text: "Compreende sentenças na voz passiva" },
      { key: "lc-50", num: 50, text: "Aliteração. Identificação de sílabas iniciais" },
      { key: "lc-51", num: 51, text: "Rima. Identificação de sílabas finais" },
      { key: "lc-52", num: 52, text: "Combinação de sons (fonemas)" },
    ],
    expressive: [
      { key: "le-54", num: 54, text: "Relembra e descreve situações da sua rotina diária" },
      { key: "le-55", num: 55, text: "Relembrando sentença em um contexto" },
      { key: "le-56", num: 56, text: "Produz uma história diante de uma sequência de figuras" },
      { key: "le-57", num: 57, text: "Faz cálculo de soma e subtração até 5" },
      { key: "le-58", num: 58, text: "Identifica e Nomeia letras" },
    ],
  },
];
