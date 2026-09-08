/**
 * Habilidades cognitivo-linguísticas — estrutura tipo PCL-R (genérico).
 *
 * A ESTRUTURA (oito domínios de habilidades e escala de três pontos)
 * reproduz o que é descrito em fontes abertas. O TEXTO de cada item é
 * original desta base e NÃO copia nem parafraseia o protocolo PCL-R
 * (Book Toy) ou qualquer adaptação.
 *
 * Fonte da estrutura:
 * - https://ebooks.marilia.unesp.br/index.php/lab_editorial/catalog/book/346
 */
import type { ProtocolTemplate } from "./types";

export const pclTemplate: ProtocolTemplate = {
  name: "pcl",
  displayName: "Habilidades cognitivo-linguísticas (estrutura tipo PCL-R, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: { 0: "Abaixo do esperado", 1: "Parcial", 2: "Esperado" },
  },
  contentLicense: "original",
  sources: [
    "https://ebooks.marilia.unesp.br/index.php/lab_editorial/catalog/book/346",
  ],
  notes:
    "Pontue cada habilidade comparando o desempenho ao esperado para a série escolar: 2 = desempenho esperado, 1 = parcial, 0 = abaixo do esperado. Itens de texto original; a estrutura em oito domínios segue descrições publicadas em fontes abertas.",
  domains: [
    {
      domain: "Leitura",
      items: [
        { code: "LEI-01", description: "Lê letras isoladas do alfabeto apresentadas em ordem aleatória." },
        { code: "LEI-02", description: "Lê palavras regulares de uso frequente com correspondência direta letra-som." },
        { code: "LEI-03", description: "Lê palavras irregulares ou de grafia menos previsível sem regularizá-las." },
        { code: "LEI-04", description: "Lê pseudopalavras aplicando as regras de conversão grafema-fonema." },
        { code: "LEI-05", description: "Lê um texto curto e responde a perguntas sobre seu conteúdo." },
      ],
    },
    {
      domain: "Escrita",
      items: [
        { code: "ESC-01", description: "Escreve o próprio nome completo de forma legível e sem omissões." },
        { code: "ESC-02", description: "Escreve letras ditadas pelo examinador em ordem aleatória." },
        { code: "ESC-03", description: "Escreve palavras ditadas com grafia regular sem trocas ou omissões." },
        { code: "ESC-04", description: "Escreve pseudopalavras ditadas respeitando a sequência de sons ouvida." },
        { code: "ESC-05", description: "Produz frase escrita a partir de uma figura, com estrutura compreensível." },
      ],
    },
    {
      domain: "Habilidades metafonológicas",
      items: [
        { code: "MET-01", description: "Identifica se duas palavras ouvidas rimam entre si." },
        { code: "MET-02", description: "Identifica qual palavra de um grupo começa com o mesmo som de outra." },
        { code: "MET-03", description: "Segmenta oralmente palavras em sílabas indicando quantas partes têm." },
        { code: "MET-04", description: "Segmenta oralmente palavras curtas em seus sons individuais." },
        { code: "MET-05", description: "Diz a palavra que resulta ao retirar o primeiro som ou sílaba de outra palavra." },
      ],
    },
    {
      domain: "Memória operacional fonológica",
      items: [
        { code: "MOF-01", description: "Repete sequências de números ouvidas na mesma ordem, aumentando a extensão." },
        { code: "MOF-02", description: "Repete sequências de números na ordem inversa à ouvida." },
        { code: "MOF-03", description: "Repete pseudopalavras de duas a cinco sílabas logo após ouvi-las." },
        { code: "MOF-04", description: "Repete frases de extensão crescente sem omitir ou trocar palavras." },
        { code: "MOF-05", description: "Lembra uma lista de palavras ouvidas após breve intervalo com outra tarefa." },
      ],
    },
    {
      domain: "Processamento auditivo",
      items: [
        { code: "PAU-01", description: "Diz se pares de palavras ouvidas são iguais ou diferentes, incluindo pares mínimos." },
        { code: "PAU-02", description: "Identifica sons não verbais do cotidiano apresentados em gravação." },
        { code: "PAU-03", description: "Reproduz padrão rítmico de batidas apresentado pelo examinador." },
        { code: "PAU-04", description: "Segue instruções orais com duas ou três etapas apresentadas de uma vez." },
        { code: "PAU-05", description: "Compreende palavras ditas com ruído de fundo em volume moderado." },
      ],
    },
    {
      domain: "Processamento visual",
      items: [
        { code: "PVI-01", description: "Encontra figura igual ao modelo entre alternativas visualmente semelhantes." },
        { code: "PVI-02", description: "Localiza letras ou símbolos alvo em uma linha de distratores." },
        { code: "PVI-03", description: "Reproduz sequência de figuras apresentada por alguns segundos e retirada." },
        { code: "PVI-04", description: "Copia formas geométricas e figuras simples mantendo proporções e orientação." },
        { code: "PVI-05", description: "Distingue letras espelhadas ou invertidas da forma correta." },
      ],
    },
    {
      domain: "Velocidade de processamento",
      items: [
        { code: "VEL-01", description: "Nomeia rapidamente uma sequência de figuras em cartela dentro do tempo esperado." },
        { code: "VEL-02", description: "Nomeia rapidamente uma sequência de cores dentro do tempo esperado." },
        { code: "VEL-03", description: "Nomeia rapidamente uma sequência de números dentro do tempo esperado." },
        { code: "VEL-04", description: "Nomeia rapidamente uma sequência de letras dentro do tempo esperado." },
        { code: "VEL-05", description: "Marca símbolos alvo em uma folha dentro de tempo limitado com poucos erros." },
      ],
    },
    {
      domain: "Raciocínio lógico",
      items: [
        { code: "RAC-01", description: "Completa sequência de figuras ou cores identificando o padrão de repetição." },
        { code: "RAC-02", description: "Ordena figuras de uma história em sequência temporal coerente." },
        { code: "RAC-03", description: "Identifica qual elemento não pertence a um grupo de quatro e explica por quê." },
        { code: "RAC-04", description: "Resolve problema simples com quantidades até dez apresentado oralmente." },
        { code: "RAC-05", description: "Explica semelhança entre dois objetos ou conceitos apresentados em par." },
      ],
    },
  ],
};

export default pclTemplate;
