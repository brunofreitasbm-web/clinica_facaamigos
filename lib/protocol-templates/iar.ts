/**
 * Repertório básico para alfabetização — estrutura tipo IAR (genérico).
 *
 * A ESTRUTURA (13 áreas de pré-requisitos e escala por percentual de
 * acertos) reproduz o que é descrito em fontes abertas. O TEXTO de cada
 * item é original desta base e NÃO copia nem parafraseia o instrumento IAR
 * (EDICON) ou qualquer adaptação.
 *
 * Fonte da estrutura:
 * - http://educa.fcc.org.br/scielo.php?script=sci_arttext&pid=S2237-94602020000100278
 */
import type { ProtocolTemplate } from "./types";

export const iarTemplate: ProtocolTemplate = {
  name: "iar",
  displayName: "Repertório básico para alfabetização (estrutura tipo IAR, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: {
      0: "Muita dificuldade (≤49%)",
      1: "Alguma dificuldade (50-99%)",
      2: "Acerto total",
    },
  },
  contentLicense: "original",
  sources: [
    "http://educa.fcc.org.br/scielo.php?script=sci_arttext&pid=S2237-94602020000100278",
  ],
  notes:
    "Cada item representa um conjunto de tentativas; pontue pelo percentual de acertos: 2 = acertou tudo, 1 = acertou entre 50% e 99%, 0 = acertou 49% ou menos. Itens de texto original; a estrutura em 13 áreas segue descrições publicadas em fontes abertas.",
  domains: [
    {
      domain: "Esquema corporal",
      items: [
        { code: "ESC-01", description: "Aponta em si mesma partes do corpo nomeadas, como cabeça, joelho, cotovelo e calcanhar." },
        { code: "ESC-02", description: "Nomeia partes do corpo apontadas em um boneco ou em uma figura humana." },
        { code: "ESC-03", description: "Monta figura humana com peças recortadas colocando cada parte no lugar correto." },
      ],
    },
    {
      domain: "Lateralidade",
      items: [
        { code: "LAT-01", description: "Levanta a mão direita e a mão esquerda quando solicitado, sem trocar." },
        { code: "LAT-02", description: "Toca com a mão indicada a orelha ou o pé do lado pedido pelo examinador." },
        { code: "LAT-03", description: "Indica qual objeto está à sua direita e qual está à sua esquerda sobre a mesa." },
      ],
    },
    {
      domain: "Posição",
      items: [
        { code: "POS-01", description: "Coloca um objeto em cima, embaixo e ao lado de uma caixa quando solicitado." },
        { code: "POS-02", description: "Identifica em figuras qual elemento está dentro e qual está fora de um recipiente." },
        { code: "POS-03", description: "Diz se o brinquedo está na frente ou atrás de outro brinquedo mostrado." },
      ],
    },
    {
      domain: "Direção",
      items: [
        { code: "DIR-01", description: "Traça linha da esquerda para a direita seguindo pontos de início e fim." },
        { code: "DIR-02", description: "Indica em figura de seta se ela aponta para cima, para baixo ou para o lado." },
        { code: "DIR-03", description: "Desloca um carrinho na direção verbalizada pelo examinador, como para frente ou para trás." },
      ],
    },
    {
      domain: "Espaço",
      items: [
        { code: "ESP-01", description: "Identifica qual de dois objetos está mais perto e qual está mais longe de si." },
        { code: "ESP-02", description: "Reproduz em folha a posição de três figuras conforme modelo apresentado." },
        { code: "ESP-03", description: "Aponta o que está no alto e o que está embaixo em uma figura de cena." },
      ],
    },
    {
      domain: "Tamanho",
      items: [
        { code: "TAM-01", description: "Aponta o maior e o menor entre três objetos de mesma forma." },
        { code: "TAM-02", description: "Ordena quatro bastões do mais curto ao mais comprido." },
        { code: "TAM-03", description: "Identifica em figuras qual pessoa é mais alta e qual é mais baixa." },
      ],
    },
    {
      domain: "Quantidade",
      items: [
        { code: "QTD-01", description: "Indica qual de dois conjuntos de objetos tem mais e qual tem menos." },
        { code: "QTD-02", description: "Entrega a quantidade de fichas solicitada, de um a cinco." },
        { code: "QTD-03", description: "Reconhece grupo com nenhum, um e muitos elementos quando perguntado." },
      ],
    },
    {
      domain: "Forma",
      items: [
        { code: "FOR-01", description: "Pareia formas geométricas iguais em cartões, como círculo, quadrado e triângulo." },
        { code: "FOR-02", description: "Encaixa formas em tabuleiro de furos correspondentes sem forçar." },
        { code: "FOR-03", description: "Nomeia círculo, quadrado, triângulo e retângulo apresentados um a um." },
      ],
    },
    {
      domain: "Discriminação visual",
      items: [
        { code: "DVI-01", description: "Encontra a figura igual ao modelo entre quatro figuras parecidas." },
        { code: "DVI-02", description: "Aponta a letra igual ao modelo entre letras de traçado semelhante." },
        { code: "DVI-03", description: "Identifica qual figura está diferente em uma fila de figuras quase iguais." },
      ],
    },
    {
      domain: "Discriminação auditiva",
      items: [
        { code: "DAU-01", description: "Diz se duas palavras ouvidas são iguais ou diferentes, incluindo pares mínimos." },
        { code: "DAU-02", description: "Identifica qual das figuras começa com o mesmo som de uma palavra ouvida." },
        { code: "DAU-03", description: "Reconhece sons do cotidiano gravados, como campainha, cachorro e chuva." },
      ],
    },
    {
      domain: "Verbalização de palavras",
      items: [
        { code: "VER-01", description: "Nomeia figuras de objetos comuns com pronúncia inteligível." },
        { code: "VER-02", description: "Repete palavras de três e quatro sílabas ditas pelo examinador." },
        { code: "VER-03", description: "Diz o nome de figuras de ações usando o verbo correspondente." },
      ],
    },
    {
      domain: "Análise-síntese",
      items: [
        { code: "ANS-01", description: "Separa oralmente uma palavra em sílabas batendo palmas para cada parte." },
        { code: "ANS-02", description: "Junta sílabas ditas separadamente e diz a palavra formada." },
        { code: "ANS-03", description: "Monta figura recortada em três ou quatro partes reconstituindo o todo." },
      ],
    },
    {
      domain: "Coordenação motora fina",
      items: [
        { code: "CMF-01", description: "Traça linhas retas e curvas entre dois limites sem sair do caminho." },
        { code: "CMF-02", description: "Copia figuras simples como círculo, cruz e quadrado a partir de modelo." },
        { code: "CMF-03", description: "Recorta com tesoura ao longo de linha reta e curva com desvio pequeno." },
      ],
    },
  ],
};

export default iarTemplate;
