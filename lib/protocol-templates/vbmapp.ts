/**
 * Template genérico de comportamento verbal com estrutura tipo VB-MAPP.
 *
 * A ESTRUTURA (3 níveis por faixa etária, domínios por nível e a escala
 * 0 / parcial / total) é reproduzida a partir de descrições públicas do
 * instrumento. O TEXTO DE CADA ITEM É ORIGINAL — nenhum item foi copiado ou
 * parafraseado do manual do VB-MAPP nem de traduções. Não usar a marca como
 * nome do produto.
 *
 * Escala: 0 = Não, 1 = Parcial, 2 = Sim (equivale a 0 / 0,5 / 1 do original).
 *
 * Fontes (estrutura):
 * - https://marksundberg.com/vb-mapp/
 */
import type { ProtocolTemplate, ProtocolTemplateDomain } from "./types";

type Spec = { prefix: string; domain: string; items: string[] };

function build(levelCode: string, level: string, specs: Spec[]): ProtocolTemplateDomain[] {
  return specs.map((s) => ({
    domain: s.domain,
    level,
    items: s.items.map((description, i) => ({
      code: `${levelCode}-${s.prefix}-${String(i + 1).padStart(2, "0")}`,
      description,
    })),
  }));
}

const NIVEL_1 = build("N1", "Nível 1 (0-18 meses)", [
  {
    prefix: "MAN",
    domain: "Mando",
    items: [
      "Pede um item preferido usando uma palavra, sinal ou figura quando o item está à vista.",
      "Faz pedidos de forma espontânea, sem que o adulto pergunte o que ele quer.",
      "Pede pelo menos 4 itens diferentes usando formas de resposta distintas entre si.",
      "Pede ações simples do adulto, como empurrar ou abrir, quando quer que continuem.",
      "Faz ao menos 10 pedidos diferentes ao longo de um dia sem dica verbal.",
    ],
  },
  {
    prefix: "TAT",
    domain: "Tato",
    items: [
      "Nomeia um objeto ou pessoa familiar quando alguém aponta e pergunta o que é.",
      "Nomeia pelo menos 4 itens diferentes ao vê-los, sem estar pedindo por eles.",
      "Nomeia pessoas da família ou figuras de um livro quando solicitado pelo adulto.",
      "Nomeia espontaneamente objetos do ambiente sem que ninguém tenha perguntado.",
      "Nomeia ao menos 10 itens distintos, incluindo objetos, pessoas e animais.",
    ],
  },
  {
    prefix: "OUV",
    domain: "Resposta de ouvinte",
    items: [
      "Vira a cabeça ou olha para o adulto quando escuta o próprio nome.",
      "Olha para o item nomeado pelo adulto quando dois objetos estão à sua frente.",
      "Segue instruções simples de uma etapa, como sentar ou vir até o adulto.",
      "Toca ou aponta partes do próprio corpo quando o adulto as nomeia.",
      "Seleciona o item correto entre pelo menos 4 opções quando o adulto o nomeia.",
    ],
  },
  {
    prefix: "VPM",
    domain: "Percepção visual e pareamento",
    items: [
      "Acompanha com os olhos um objeto que se move lentamente à sua frente.",
      "Alcança ou pega um item que foi parcialmente escondido sob um pano.",
      "Coloca peças simples em um encaixe de formas ou empilha alguns blocos.",
      "Pareia objetos idênticos quando o adulto entrega um e há duas opções na mesa.",
      "Pareia figuras idênticas entre pelo menos 4 opções sem ajuda física.",
    ],
  },
  {
    prefix: "BRI",
    domain: "Brincar independente",
    items: [
      "Manipula brinquedos com as mãos por alguns minutos sem estímulo do adulto.",
      "Explora brinquedos de causa e efeito, acionando botões ou alavancas repetidamente.",
      "Brinca sozinho com um brinquedo de encaixe ou empilhamento por cerca de 2 minutos.",
      "Usa um brinquedo da forma esperada, como empurrar carrinho ou bater em tambor.",
      "Alterna entre brinquedos variados durante 5 minutos sem precisar de direcionamento.",
    ],
  },
  {
    prefix: "SOC",
    domain: "Comportamento social e brincar social",
    items: [
      "Estabelece contato visual com o cuidador e sorri em resposta ao sorriso dele.",
      "Olha para outra criança e a observa brincar por alguns segundos.",
      "Aproxima-se de outra criança e permanece perto dela durante uma atividade.",
      "Participa de brincadeiras de troca com o adulto, como devolver uma bola rolada.",
      "Imita ou responde a uma iniciativa social de outra criança durante o brincar.",
    ],
  },
  {
    prefix: "IMI",
    domain: "Imitação motora",
    items: [
      "Imita 2 ações motoras amplas do adulto, como bater palmas ou levantar os braços.",
      "Imita ações com objetos, como bater uma colher na mesa ou balançar um chocalho.",
      "Imita ao menos 8 ações motoras diferentes quando o adulto diz para fazer igual.",
      "Imita movimentos finos, como abrir e fechar a mão ou tocar o próprio nariz.",
      "Imita espontaneamente ações do adulto observadas durante as rotinas do dia.",
    ],
  },
  {
    prefix: "ECO",
    domain: "Ecoico",
    items: [
      "Repete sons vocálicos simples logo após o adulto produzi-los.",
      "Repete sílabas simples, como ma ou pa, quando o adulto as pronuncia.",
      "Repete palavras curtas de uma ou duas sílabas após o modelo do adulto.",
      "Repete ao menos 10 sílabas ou palavras diferentes com boa aproximação sonora.",
      "Repete duas palavras seguidas apresentadas pelo adulto, como dá bola.",
    ],
  },
  {
    prefix: "VOC",
    domain: "Vocalização espontânea",
    items: [
      "Produz sons ou vocalizações várias vezes por hora sem incentivo do adulto.",
      "Balbucia sequências de sílabas repetidas, como bababa, enquanto brinca.",
      "Varia a entonação das vocalizações, com subidas e descidas de tom.",
      "Produz ao menos 5 combinações diferentes de consoante e vogal de forma espontânea.",
      "Vocaliza em direção a pessoas ou objetos, como se estivesse conversando.",
    ],
  },
]);

const NIVEL_2 = build("N2", "Nível 2 (18-30 meses)", [
  {
    prefix: "MAN",
    domain: "Mando",
    items: [
      "Pede itens ou ações usando pelo menos 20 palavras ou sinais diferentes.",
      "Pede que o adulto faça algo específico, como abrir ou empurrar, em contextos variados.",
      "Pede itens que não estão à vista, mostrando que sabe o que quer.",
      "Pede informação usando perguntas simples, como o que é isso ou cadê.",
      "Combina duas palavras em um pedido, como quero suco ou mais bola.",
    ],
  },
  {
    prefix: "TAT",
    domain: "Tato",
    items: [
      "Nomeia pelo menos 50 objetos, pessoas ou figuras quando perguntado.",
      "Nomeia ações em andamento, como correndo ou comendo, ao vê-las acontecer.",
      "Nomeia partes de objetos, como a roda do carro, quando indicadas pelo adulto.",
      "Combina substantivo com verbo ou adjetivo ao nomear, como bola grande.",
      "Nomeia ao menos 200 itens diferentes, incluindo ações e adjetivos.",
    ],
  },
  {
    prefix: "OUV",
    domain: "Resposta de ouvinte",
    items: [
      "Seleciona o item nomeado entre pelo menos 6 opções em uma página de livro.",
      "Segue instruções de duas etapas, como pegar o copo e colocar na mesa.",
      "Realiza ações simples quando solicitado sem objeto presente, como pular ou girar.",
      "Seleciona itens pelo uso quando o adulto pergunta qual serve para beber.",
      "Segue ao menos 20 instruções diferentes envolvendo objetos e ações.",
    ],
  },
  {
    prefix: "VPM",
    domain: "Percepção visual e pareamento",
    items: [
      "Pareia figuras idênticas entre 8 opções quando o adulto entrega uma delas.",
      "Pareia objetos com as figuras correspondentes entre várias opções.",
      "Pareia itens semelhantes que não são idênticos, como copos de cores diferentes.",
      "Separa objetos em duas categorias simples, como animais e comidas.",
      "Completa quebra-cabeças de encaixe de 4 a 6 peças sem auxílio.",
    ],
  },
  {
    prefix: "BRI",
    domain: "Brincar independente",
    items: [
      "Usa brinquedos simbólicos com finalidade, como dar comida a uma boneca.",
      "Constrói com blocos ou peças de encaixe seguindo uma ideia própria.",
      "Brinca sozinho de forma variada por pelo menos 5 minutos seguidos.",
      "Organiza brinquedos em sequências simples, como fazer uma fila de carrinhos.",
      "Realiza brincadeiras de faz de conta com dois ou mais passos encadeados.",
    ],
  },
  {
    prefix: "SOC",
    domain: "Comportamento social e brincar social",
    items: [
      "Responde de forma espontânea ao pedido ou comentário de outra criança.",
      "Inicia interação com outra criança, oferecendo um brinquedo ou chamando-a.",
      "Brinca em paralelo com outras crianças por pelo menos 5 minutos.",
      "Pede a outra criança que participe ou entregue algo durante o brincar.",
      "Alterna a vez com colegas em jogos simples com mediação mínima do adulto.",
    ],
  },
  {
    prefix: "IMI",
    domain: "Imitação motora",
    items: [
      "Imita ao menos 20 ações motoras diferentes quando solicitado.",
      "Imita sequências de duas ações apresentadas em seguida pelo adulto.",
      "Imita ações observadas em outra criança durante atividades de grupo.",
      "Imita gestos finos e expressões faciais quando o adulto modela.",
      "Imita ações novas em brincadeiras sem instrução explícita para imitar.",
    ],
  },
  {
    prefix: "ECO",
    domain: "Ecoico",
    items: [
      "Repete frases de duas palavras com clareza suficiente para ser entendido.",
      "Repete ao menos 50 palavras diferentes após o modelo do adulto.",
      "Repete frases de três ou mais palavras mantendo a ordem correta.",
      "Repete palavras com sílabas complexas, como borboleta ou chocolate.",
      "Repete o modelo do adulto para corrigir a pronúncia de uma palavra.",
    ],
  },
  {
    prefix: "LRF",
    domain: "Resposta de ouvinte por função/característica/classe (LRFFC)",
    items: [
      "Seleciona a figura correta quando o adulto descreve a função, como qual serve para comer.",
      "Seleciona o item pelo som que ele faz, como qual animal late.",
      "Seleciona o item por uma característica, como qual é vermelho.",
      "Seleciona o item pela classe, como mostrar um animal entre vários objetos.",
      "Responde a pelo menos 25 pedidos diferentes envolvendo função, característica ou classe.",
    ],
  },
  {
    prefix: "INT",
    domain: "Intraverbal",
    items: [
      "Completa músicas ou frases conhecidas quando o adulto deixa uma lacuna.",
      "Responde a perguntas simples sobre si, como o próprio nome.",
      "Completa frases com o nome de um objeto pela função, como escova o cabelo com.",
      "Responde a perguntas do tipo o que é sobre itens fora de vista.",
      "Responde a pelo menos 25 perguntas ou completamentos de frase diferentes.",
    ],
  },
  {
    prefix: "GRP",
    domain: "Comportamento em grupo",
    items: [
      "Permanece sentado em atividade de grupo pequeno por 2 minutos sem sair.",
      "Olha e atende à professora quando ela dá uma instrução ao grupo.",
      "Responde a instruções dirigidas ao grupo, como todos levantarem.",
      "Participa de atividades de grupo, como música ou roda, por 5 minutos.",
      "Aguarda a vez em atividades coletivas sem exigir atenção individual constante.",
    ],
  },
  {
    prefix: "LIN",
    domain: "Estrutura linguística",
    items: [
      "Produz palavras com pelo menos 10 fonemas diferentes de forma clara.",
      "Combina duas palavras em frases próprias, como papai foi.",
      "Usa artigos ou preposições simples em algumas frases, como no carro.",
      "Usa plural ou marcas de tempo verbal em frases espontâneas.",
      "Produz frases de três palavras com sujeito, verbo e objeto.",
    ],
  },
]);

const NIVEL_3 = build("N3", "Nível 3 (30-48 meses)", [
  {
    prefix: "MAN",
    domain: "Mando",
    items: [
      "Pede informação usando perguntas variadas, como onde, quem e por quê.",
      "Usa adjetivos ou advérbios nos pedidos, como querer o copo azul.",
      "Pede para outras pessoas realizarem tarefas de vários passos.",
      "Faz pedidos no momento adequado, aguardando pausas na conversa dos outros.",
      "Pede ajuda ou esclarecimento quando não entende uma instrução.",
    ],
  },
  {
    prefix: "TAT",
    domain: "Tato",
    items: [
      "Nomeia ao menos 4 características ou cores de um objeto quando perguntado.",
      "Nomeia relações espaciais, como em cima ou atrás, ao olhar figuras.",
      "Nomeia a função de objetos ao vê-los, como dizer que serve para cortar.",
      "Descreve cenas de figuras usando frases de várias palavras.",
      "Nomeia ao menos 1000 itens, incluindo substantivos, verbos e adjetivos.",
    ],
  },
  {
    prefix: "OUV",
    domain: "Resposta de ouvinte",
    items: [
      "Segue instruções com preposições, como colocar o livro debaixo da mesa.",
      "Seleciona o item por duas características combinadas, como o carro grande e azul.",
      "Segue instruções de três etapas sem repetição do adulto.",
      "Segue instruções envolvendo negação, como pegar o que não é vermelho.",
      "Executa instruções que envolvem ordem e sequência, como primeiro e depois.",
    ],
  },
  {
    prefix: "VPM",
    domain: "Percepção visual e pareamento",
    items: [
      "Separa itens em ao menos 5 categorias diferentes sem modelo presente.",
      "Continua um padrão simples de blocos ou figuras, como alternar duas cores.",
      "Reproduz construções de 6 a 8 peças a partir de um modelo ou figura.",
      "Monta quebra-cabeças de 10 ou mais peças sem ajuda.",
      "Aponta semelhanças e diferenças entre duas figuras quando solicitado.",
    ],
  },
  {
    prefix: "BRI",
    domain: "Brincar independente",
    items: [
      "Brinca de faz de conta assumindo papéis, como ser médico ou cozinheiro.",
      "Constrói cenários com brinquedos e narra o que está acontecendo.",
      "Mantém-se em uma atividade independente por 10 minutos com objetivo próprio.",
      "Usa objetos substitutos no brincar, como uma caixa que vira carro.",
      "Realiza atividades de desenho ou colagem com propósito definido até concluir.",
    ],
  },
  {
    prefix: "SOC",
    domain: "Comportamento social e brincar social",
    items: [
      "Participa de brincadeiras cooperativas com pares seguindo um tema compartilhado.",
      "Inicia conversas com colegas sobre atividades ou interesses em comum.",
      "Responde a perguntas de colegas e mantém a troca por várias falas.",
      "Negocia com colegas sobre regras ou papéis durante as brincadeiras.",
      "Convida outra criança para brincar e adapta o brincar ao interesse dela.",
    ],
  },
  {
    prefix: "LEI",
    domain: "Leitura",
    items: [
      "Reconhece o próprio nome escrito entre outras palavras.",
      "Nomeia ao menos 10 letras do alfabeto quando mostradas.",
      "Relaciona algumas letras ao som inicial de palavras, como b de bola.",
      "Lê palavras curtas e familiares, como rótulos ou nomes de colegas.",
      "Pareia palavras escritas com as figuras correspondentes em 5 pares.",
    ],
  },
  {
    prefix: "ESC",
    domain: "Escrita",
    items: [
      "Segura o lápis com preensão funcional e faz traços intencionais.",
      "Copia formas básicas, como círculo, cruz e linhas retas.",
      "Copia algumas letras do próprio nome a partir de um modelo.",
      "Escreve o próprio nome de forma legível sem modelo.",
      "Escreve ao menos 5 letras quando o adulto as nomeia.",
    ],
  },
  {
    prefix: "LRF",
    domain: "LRFFC",
    items: [
      "Seleciona o item a partir de descrição com duas características, como o animal que voa e canta.",
      "Responde a perguntas com qual envolvendo função e classe entre 10 opções.",
      "Seleciona figuras que respondem a perguntas sobre lugares, como onde se compra pão.",
      "Escolhe a figura que completa uma frase com lacuna entre várias opções.",
      "Responde a pelo menos 100 perguntas diferentes de função, característica ou classe.",
    ],
  },
  {
    prefix: "INT",
    domain: "Intraverbal",
    items: [
      "Responde a perguntas com o que, quem e onde sobre eventos recentes.",
      "Nomeia ao menos 3 itens de uma categoria quando solicitado, como quais são animais.",
      "Responde a perguntas sobre função, como o que fazemos com a tesoura.",
      "Conta acontecimentos do dia com sequência de duas ou mais ações.",
      "Mantém uma conversa de vários turnos sobre um tema definido pelo adulto.",
    ],
  },
  {
    prefix: "GRP",
    domain: "Comportamento em grupo",
    items: [
      "Segue instruções dadas ao grupo sem precisar de repetição individual.",
      "Levanta a mão ou espera a vez para falar em atividades coletivas.",
      "Trabalha em atividades de mesa em grupo por 10 minutos com supervisão mínima.",
      "Responde a perguntas da professora dirigidas ao grupo inteiro.",
      "Realiza tarefas de rotina da sala, como guardar materiais, junto com os colegas.",
    ],
  },
  {
    prefix: "LIN",
    domain: "Estrutura linguística",
    items: [
      "Produz frases de quatro ou mais palavras com estrutura gramatical adequada.",
      "Usa pronomes corretamente, como eu, você e ele, em frases espontâneas.",
      "Usa tempos verbais no passado e no futuro em frases espontâneas.",
      "Faz perguntas com entonação adequada, como pedir se pode brincar.",
      "Fala de forma inteligível para pessoas não familiares na maior parte do tempo.",
    ],
  },
  {
    prefix: "MAT",
    domain: "Matemática",
    items: [
      "Conta em sequência até 10 sem pular números.",
      "Conta objetos até 5 tocando cada um e diz a quantidade total.",
      "Reconhece e nomeia os numerais de 1 a 5 quando mostrados.",
      "Compara dois conjuntos de objetos e diz qual tem mais ou menos.",
      "Pareia numerais de 1 a 5 com a quantidade correspondente de objetos.",
    ],
  },
]);

export const vbmappTemplate: ProtocolTemplate = {
  name: "vbmapp",
  displayName: "Comportamento verbal (estrutura tipo VB-MAPP, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: { 0: "Não", 1: "Parcial", 2: "Sim" },
  },
  contentLicense: "original",
  sources: ["https://marksundberg.com/vb-mapp/"],
  notes:
    "Estrutura em 3 níveis por faixa etária com 5 itens por domínio (170 itens). A escala 0/1/2 equivale a 0/0,5/1 do instrumento original. Texto dos itens é original e genérico.",
  domains: [...NIVEL_1, ...NIVEL_2, ...NIVEL_3],
};

export default vbmappTemplate;
