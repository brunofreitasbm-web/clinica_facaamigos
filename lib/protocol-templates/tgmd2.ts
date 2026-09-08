/**
 * Desenvolvimento motor grosso — estrutura tipo TGMD-2 (genérico).
 *
 * A ESTRUTURA (dois subtestes, doze habilidades e pontuação por critério em
 * duas tentativas) reproduz o que é descrito em fontes abertas. O TEXTO de
 * cada critério de desempenho é original desta base e NÃO copia nem
 * parafraseia o manual TGMD-2/TGMD-3 (Pro-Ed) ou qualquer tradução.
 *
 * Fonte da estrutura:
 * - https://periodicos.ufsc.br/index.php/rbcdh/article/download/1980-0037.2008v10n4p399/5871
 */
import type { ProtocolTemplate } from "./types";

const LOC = "Locomotor";
const OBJ = "Controle de objetos";

export const tgmd2Template: ProtocolTemplate = {
  name: "tgmd2",
  displayName: "Desenvolvimento motor grosso (estrutura tipo TGMD-2, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: { 0: "0 tentativas", 1: "1 tentativa", 2: "2 tentativas" },
  },
  contentLicense: "original",
  sources: [
    "https://periodicos.ufsc.br/index.php/rbcdh/article/download/1980-0037.2008v10n4p399/5871",
  ],
  notes:
    "Cada habilidade é executada em duas tentativas após uma demonstração. Cada critério de desempenho recebe 1 ponto por tentativa em que foi observado; o valor do item é o total nas duas tentativas (0, 1 ou 2). Critérios de texto original; a estrutura segue descrições publicadas em fontes abertas.",
  domains: [
    {
      level: LOC,
      domain: "Correr",
      items: [
        { code: "LOC-COR-01", description: "Braços flexionados nos cotovelos e movendo-se em oposição às pernas." },
        { code: "LOC-COR-02", description: "Há um breve momento em que os dois pés estão fora do chão." },
        { code: "LOC-COR-03", description: "Pé toca o chão com a parte anterior ou com o calcanhar, não com o pé plano." },
        { code: "LOC-COR-04", description: "Perna que não apoia flexiona-se cerca de noventa graus ao passar para trás." },
      ],
    },
    {
      level: LOC,
      domain: "Galopar",
      items: [
        { code: "LOC-GAL-01", description: "Braços flexionados e elevados na altura da cintura durante o deslocamento." },
        { code: "LOC-GAL-02", description: "Um pé avança e o outro se aproxima dele, ficando atrás ou ao lado." },
        { code: "LOC-GAL-03", description: "Há um breve momento em que os dois pés estão fora do chão." },
        { code: "LOC-GAL-04", description: "Mantém o mesmo pé à frente por quatro galopes seguidos em ritmo regular." },
      ],
    },
    {
      level: LOC,
      domain: "Saltitar em um pé",
      items: [
        { code: "LOC-SAL-01", description: "Perna livre balança para frente como pêndulo para gerar impulso." },
        { code: "LOC-SAL-02", description: "Pé da perna livre permanece atrás do corpo, sem tocar o chão." },
        { code: "LOC-SAL-03", description: "Braços flexionados balançam para frente para ajudar no impulso." },
        { code: "LOC-SAL-04", description: "Realiza três saltos consecutivos no pé preferido e depois no outro pé." },
      ],
    },
    {
      level: LOC,
      domain: "Passada (leap)",
      items: [
        { code: "LOC-PAS-01", description: "Impulsiona-se com um pé e aterrissa com o pé oposto." },
        { code: "LOC-PAS-02", description: "Há um momento em que os dois pés estão fora do chão, mais longo que na corrida." },
        { code: "LOC-PAS-03", description: "Braço oposto à perna que avança estende-se para a frente." },
        { code: "LOC-PAS-04", description: "Transpõe o obstáculo baixo sem tocá-lo nem interromper o deslocamento." },
      ],
    },
    {
      level: LOC,
      domain: "Salto horizontal",
      items: [
        { code: "LOC-SHO-01", description: "Antes do salto, flexiona os joelhos e leva os braços estendidos para trás." },
        { code: "LOC-SHO-02", description: "Braços se estendem com força para a frente e para cima no impulso." },
        { code: "LOC-SHO-03", description: "Decola e aterrissa com os dois pés ao mesmo tempo." },
        { code: "LOC-SHO-04", description: "Braços descem para a frente ao aterrissar, sem queda para trás." },
      ],
    },
    {
      level: LOC,
      domain: "Corrida lateral",
      items: [
        { code: "LOC-CLA-01", description: "Corpo permanece de lado, com os ombros alinhados à linha de deslocamento." },
        { code: "LOC-CLA-02", description: "Um passo para o lado seguido de deslize do pé de trás até o pé da frente." },
        { code: "LOC-CLA-03", description: "Realiza pelo menos quatro ciclos seguidos para a direita." },
        { code: "LOC-CLA-04", description: "Realiza pelo menos quatro ciclos seguidos para a esquerda." },
      ],
    },
    {
      level: OBJ,
      domain: "Rebater bola parada",
      items: [
        { code: "OBJ-REB-01", description: "Segura o bastão com a mão dominante acima da outra mão." },
        { code: "OBJ-REB-02", description: "Lado não dominante do corpo fica voltado para o alvo e pés afastados." },
        { code: "OBJ-REB-03", description: "Gira quadril e ombros durante o movimento de rebater." },
        { code: "OBJ-REB-04", description: "Transfere o peso para o pé da frente e acerta a bola com o bastão." },
      ],
    },
    {
      level: OBJ,
      domain: "Quicar bola parado",
      items: [
        { code: "OBJ-QUI-01", description: "Toca a bola com os dedos de uma mão na altura aproximada da cintura." },
        { code: "OBJ-QUI-02", description: "Empurra a bola para o chão com os dedos, sem bater com a palma." },
        { code: "OBJ-QUI-03", description: "Bola toca o chão à frente ou ao lado do pé do mesmo lado da mão." },
        { code: "OBJ-QUI-04", description: "Mantém quatro quiques seguidos sem mover os pés e retém a bola ao final." },
      ],
    },
    {
      level: OBJ,
      domain: "Receber",
      items: [
        { code: "OBJ-REC-01", description: "Na preparação, mãos ficam à frente do corpo com cotovelos flexionados." },
        { code: "OBJ-REC-02", description: "Braços se estendem em direção à bola enquanto ela se aproxima." },
        { code: "OBJ-REC-03", description: "Bola é presa apenas com as mãos, sem uso do peito ou dos braços." },
        { code: "OBJ-REC-04", description: "Cotovelos flexionam para amortecer a bola após o contato com as mãos." },
      ],
    },
    {
      level: OBJ,
      domain: "Chutar",
      items: [
        { code: "OBJ-CHU-01", description: "Aproxima-se da bola em deslocamento rápido e contínuo." },
        { code: "OBJ-CHU-02", description: "Dá um passo alongado ou um pequeno salto antes do contato com a bola." },
        { code: "OBJ-CHU-03", description: "Pé de apoio fica ao lado da bola ou um pouco atrás dela no momento do chute." },
        { code: "OBJ-CHU-04", description: "Chuta a bola com o peito do pé ou com a ponta, não com a lateral." },
      ],
    },
    {
      level: OBJ,
      domain: "Arremessar por cima",
      items: [
        { code: "OBJ-ARR-01", description: "Inicia o movimento levando a mão com a bola para baixo e para trás." },
        { code: "OBJ-ARR-02", description: "Gira quadril e ombros de modo que o lado oposto ao braço fique voltado ao alvo." },
        { code: "OBJ-ARR-03", description: "Transfere o peso avançando com o pé oposto ao braço que arremessa." },
        { code: "OBJ-ARR-04", description: "Após soltar a bola, o braço continua o movimento cruzando o corpo em diagonal." },
      ],
    },
    {
      level: OBJ,
      domain: "Rolar por baixo",
      items: [
        { code: "OBJ-ROL-01", description: "Mão com a bola balança para baixo e para trás, tronco voltado para o alvo." },
        { code: "OBJ-ROL-02", description: "Avança com o pé oposto à mão que segura a bola." },
        { code: "OBJ-ROL-03", description: "Flexiona joelhos para aproximar o corpo do chão antes de soltar a bola." },
        { code: "OBJ-ROL-04", description: "Solta a bola rente ao chão, sem que ela quique mais de uma vez." },
      ],
    },
  ],
};

export default tgmd2Template;
