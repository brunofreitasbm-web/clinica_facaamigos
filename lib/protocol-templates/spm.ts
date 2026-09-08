/**
 * Processamento sensorial por sistemas — estrutura tipo SPM (genérico).
 *
 * A ESTRUTURA (oito sistemas/áreas e escala de frequência de quatro pontos
 * respondida pelo cuidador) reproduz o que é descrito em fontes abertas. O
 * TEXTO de cada item é original desta base e NÃO copia nem parafraseia o
 * questionário SPM/SPM-2 (WPS) ou qualquer tradução.
 *
 * Fonte da estrutura:
 * - https://www.theraplatform.com/blog/797/the-new-sensory-processing-measure-2-spm-2
 */
import type { ProtocolTemplate } from "./types";

type RawItem = { code: string; description: string };

function inverted(items: RawItem[]) {
  return items.map((i) => ({ ...i, inverted: true as const }));
}

export const spmTemplate: ProtocolTemplate = {
  name: "spm",
  displayName: "Processamento sensorial por sistemas (estrutura tipo SPM, genérico)",
  version: "1.0",
  scale: {
    max: 4,
    min: 1,
    labels: { 1: "Nunca", 2: "Ocasionalmente", 3: "Frequentemente", 4: "Sempre" },
  },
  contentLicense: "original",
  sources: [
    "https://www.theraplatform.com/blog/797/the-new-sensory-processing-measure-2-spm-2",
  ],
  notes:
    "Questionário respondido pelo cuidador sobre a frequência de comportamentos no dia a dia. Todos os itens são invertidos: pontuação mais alta indica MAIS dificuldade de processamento sensorial (1 = nunca, 4 = sempre). Itens de texto original; a estrutura em oito sistemas segue descrições publicadas em fontes abertas.",
  domains: [
    {
      domain: "Visão",
      items: inverted([
        { code: "VIS-01", description: "Incomoda-se com luz forte ou ambientes muito iluminados, fechando ou cobrindo os olhos." },
        { code: "VIS-02", description: "Fica atraída por luzes, reflexos ou objetos que giram, observando-os por muito tempo." },
        { code: "VIS-03", description: "Tem dificuldade para encontrar um objeto em gaveta ou prateleira cheia." },
        { code: "VIS-04", description: "Distrai-se com estímulos visuais ao redor durante tarefas ou refeições." },
        { code: "VIS-05", description: "Olha para objetos de canto de olho ou aproxima-os demais do rosto." },
        { code: "VIS-06", description: "Perde a linha ao ler ou ao copiar de um quadro para o caderno." },
      ]),
    },
    {
      domain: "Audição",
      items: inverted([
        { code: "AUD-01", description: "Tapa os ouvidos ou se angustia com sons altos como liquidificador, sirene ou fogos." },
        { code: "AUD-02", description: "Não responde quando chamada pelo nome, mesmo com audição normal." },
        { code: "AUD-03", description: "Distrai-se com ruídos de fundo que outras pessoas não notam." },
        { code: "AUD-04", description: "Produz sons ou fala em volume alto sem perceber." },
        { code: "AUD-05", description: "Precisa que instruções sejam repetidas mais vezes do que outras crianças da idade." },
        { code: "AUD-06", description: "Evita lugares barulhentos como festas, ginásios ou refeitórios." },
      ]),
    },
    {
      domain: "Tato",
      items: inverted([
        { code: "TAT-01", description: "Incomoda-se com etiquetas, costuras ou tecidos de roupa e pede para tirá-los." },
        { code: "TAT-02", description: "Reage com irritação a toques leves ou inesperados de outras pessoas." },
        { code: "TAT-03", description: "Evita sujar as mãos com tinta, areia, cola ou alimentos." },
        { code: "TAT-04", description: "Resiste a cortar unhas, cabelo ou a escovar os dentes." },
        { code: "TAT-05", description: "Não percebe quando está com o rosto sujo ou a roupa torta." },
        { code: "TAT-06", description: "Toca pessoas e objetos de forma excessiva ou busca sensações de pressão forte." },
      ]),
    },
    {
      domain: "Paladar e olfato",
      items: inverted([
        { code: "PAL-01", description: "Recusa alimentos por causa da textura, mesmo que goste do sabor." },
        { code: "PAL-02", description: "Aceita uma variedade muito restrita de alimentos, com poucas opções por refeição." },
        { code: "PAL-03", description: "Reclama de cheiros que outras pessoas não notam ou consideram fracos." },
        { code: "PAL-04", description: "Cheira objetos, alimentos ou pessoas de forma incomum antes de interagir." },
        { code: "PAL-05", description: "Tem ânsia ou engasgos com alimentos novos ou de consistência mista." },
        { code: "PAL-06", description: "Leva à boca objetos não comestíveis ou mastiga roupas e brinquedos." },
      ]),
    },
    {
      domain: "Consciência corporal (propriocepção)",
      items: inverted([
        { code: "PRO-01", description: "Usa força demais ao segurar lápis, brinquedos ou ao abraçar pessoas." },
        { code: "PRO-02", description: "Esbarra em móveis, portas ou pessoas ao se deslocar pela casa." },
        { code: "PRO-03", description: "Busca atividades de impacto como pular, bater os pés ou se jogar no sofá." },
        { code: "PRO-04", description: "Pisa forte ao andar ou bate objetos na mesa com mais força que o necessário." },
        { code: "PRO-05", description: "Derruba ou quebra objetos por não calcular a força ou a distância." },
        { code: "PRO-06", description: "Aperta ou empurra outras crianças durante brincadeiras sem perceber a intensidade." },
      ]),
    },
    {
      domain: "Equilíbrio e movimento (vestibular)",
      items: inverted([
        { code: "VES-01", description: "Fica com medo ou evita brinquedos de parque que envolvem balanço ou altura." },
        { code: "VES-02", description: "Enjoa com facilidade em carro, balanço ou giro." },
        { code: "VES-03", description: "Gira, balança ou pula com frequência e parece não se cansar." },
        { code: "VES-04", description: "Perde o equilíbrio com facilidade ao ficar em um pé ou em superfície instável." },
        { code: "VES-05", description: "Apoia a cabeça na mão ou se deita sobre a mesa durante tarefas sentadas." },
        { code: "VES-06", description: "Evita subir escadas, rampas ou terrenos irregulares sem apoio." },
      ]),
    },
    {
      domain: "Planejamento e ideias (praxia)",
      items: inverted([
        { code: "PRA-01", description: "Tem dificuldade em aprender movimentos novos, como andar de bicicleta ou pular corda." },
        { code: "PRA-02", description: "Brinca sempre da mesma forma e tem dificuldade em criar novas brincadeiras." },
        { code: "PRA-03", description: "Precisa de ajuda para organizar as etapas de tarefas como se vestir ou arrumar a mochila." },
        { code: "PRA-04", description: "Demora mais que outras crianças para realizar atividades com várias etapas." },
        { code: "PRA-05", description: "Tem dificuldade em imitar gestos ou sequências de movimentos mostradas por alguém." },
        { code: "PRA-06", description: "Parece desajeitada ao usar talheres, tesoura ou ao abotoar roupas." },
      ]),
    },
    {
      domain: "Participação social",
      items: inverted([
        { code: "SOC-01", description: "Tem dificuldade em participar de brincadeiras em grupo com outras crianças." },
        { code: "SOC-02", description: "Fica muito agitada ou se retrai em ambientes com muita gente e movimento." },
        { code: "SOC-03", description: "Tem dificuldade em manter uma conversa, respondendo fora do assunto ou não respondendo." },
        { code: "SOC-04", description: "Reage de forma intensa a mudanças de rotina ou a imprevistos no dia." },
        { code: "SOC-05", description: "Evita atividades familiares como refeições em grupo, passeios ou visitas." },
        { code: "SOC-06", description: "Tem dificuldade em respeitar turnos e regras em jogos com outras crianças." },
      ]),
    },
  ],
};

export default spmTemplate;
