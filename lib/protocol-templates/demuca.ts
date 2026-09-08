/**
 * DEMUCA — Escala de Desenvolvimento Musical de Crianças com Autismo —
 * estrutura E itens reproduzidos com atribuição (Creative Commons
 * Attribution 4.0).
 *
 * Fonte: Freire, M. H.; Martelli, J.; Sampaio, R.; Parizzi, M. B. "Validação
 * da Escala de Desenvolvimento Musical de Crianças com Autismo (DEMUCA):
 * análise semântica, interexaminadores, de construto e de critério." Revista
 * OPUS, v.25, n.3, set./dez. 2019, p. 177-186 (Anexo).
 * DOI: 10.20504/opus2019c2508 — CC BY 4.0.
 *
 * Os nomes dos 38 itens (parâmetros) abaixo são transcrição literal do
 * quadro-resumo do Anexo do artigo. Não editar sem conferir a fonte. Os
 * itens "Interação com pais" e "Interação com pares" foram marcados
 * "(se aplicável)" no original porque a validação avaliou sessões
 * individuais; mantidos aqui como itens condicionais.
 */
import type { ProtocolTemplate } from "./types";

export const demucaTemplate: ProtocolTemplate = {
  name: "demuca",
  displayName: "DEMUCA — Desenvolvimento Musical de Crianças com Autismo (CC BY 4.0)",
  version: "1.0",
  scale: { max: 2, labels: { 0: "Não", 1: "Pouco", 2: "Muito" } },
  contentLicense: "cc-by",
  attribution:
    "Freire, M. H.; Martelli, J.; Sampaio, R.; Parizzi, M. B. (2019). Validação da Escala de Desenvolvimento Musical de Crianças com Autismo (DEMUCA). Revista OPUS, 25(3), 177-186. DOI: 10.20504/opus2019c2508 — CC BY 4.0.",
  sources: ["https://www.anppom.com.br/revista/index.php/opus/article/view/opus2019c2508"],
  notes:
    "Itens reproduzidos integralmente do Anexo do artigo original, licença CC BY 4.0. Escala 0/1/2 (Não/Pouco/Muito); na categoria Comportamentos restritivos a pontuação é invertida (Não=2, Pouco=1, Muito=0 — usar `inverted: true` no cálculo). Cinco itens têm peso 2 (Apoio, Ritmo real, Contrastes de andamento, Imitação de canções, Criação vocal). O artigo relata 38 itens aplicáveis a sessões individuais (90 pontos possíveis); este template também inclui, condicionalmente, \"Interação com pais\" e \"Interação com pares\" (presentes na tabela-resumo do Anexo, marcados \"se aplicável\" para sessões em grupo ou com família presente), totalizando 40 linhas. Recomenda-se analisar o total por categoria, não só o total geral.",
  domains: [
    {
      domain: "Comportamentos restritivos",
      items: [
        { code: "CR-01", description: "Estereotipias", inverted: true },
        { code: "CR-02", description: "Agressividade", inverted: true },
        { code: "CR-03", description: "Desinteresse", inverted: true },
        { code: "CR-04", description: "Passividade", inverted: true },
        { code: "CR-05", description: "Resistência", inverted: true },
        { code: "CR-06", description: "Reclusão (isolamento)", inverted: true },
        { code: "CR-07", description: "Pirraça", inverted: true },
      ],
    },
    {
      domain: "Interação social / Cognição",
      items: [
        { code: "IC-01", description: "Contato visual" },
        { code: "IC-02", description: "Comunicação verbal" },
        { code: "IC-03", description: "Interação com instrumentos musicais" },
        { code: "IC-04", description: "Interação com outros objetos" },
        { code: "IC-05", description: "Interação com educador ou musicoterapeuta" },
        { code: "IC-06", description: "Interação com pais (se aplicável)" },
        { code: "IC-07", description: "Interação com pares (se aplicável)" },
        { code: "IC-08", description: "Atenção" },
        { code: "IC-09", description: "Imitação" },
      ],
    },
    {
      domain: "Percepção / Exploração rítmica",
      items: [
        { code: "PR-01", description: "Pulso interno" },
        { code: "PR-02", description: "Regulação temporal" },
        { code: "PR-03", description: "Apoio", weight: 2 },
        { code: "PR-04", description: "Ritmo real", weight: 2 },
        { code: "PR-05", description: "Contrastes de andamento", weight: 2 },
      ],
    },
    {
      domain: "Percepção / Exploração sonora",
      items: [
        { code: "PS-01", description: "Som/silêncio" },
        { code: "PS-02", description: "Timbre" },
        { code: "PS-03", description: "Planos de altura" },
        { code: "PS-04", description: "Movimento sonoro" },
        { code: "PS-05", description: "Contrastes de intensidade" },
        { code: "PS-06", description: "Repetição de ideias rítmicas e/ou melódicas" },
        { code: "PS-07", description: "Senso de conclusão" },
      ],
    },
    {
      domain: "Exploração vocal",
      items: [
        { code: "EV-01", description: "Vocalizações" },
        { code: "EV-02", description: "Balbucios" },
        { code: "EV-03", description: "Sílabas canônicas" },
        { code: "EV-04", description: "Imitação de canções", weight: 2 },
        { code: "EV-05", description: "Criação vocal", weight: 2 },
      ],
    },
    {
      domain: "Movimentação corporal com a música",
      items: [
        { code: "MC-01", description: "Andar" },
        { code: "MC-02", description: "Correr" },
        { code: "MC-03", description: "Parar" },
        { code: "MC-04", description: "Dançar" },
        { code: "MC-05", description: "Pular" },
        { code: "MC-06", description: "Gesticular" },
        { code: "MC-07", description: "Movimentar-se no lugar" },
      ],
    },
  ],
};

export default demucaTemplate;
