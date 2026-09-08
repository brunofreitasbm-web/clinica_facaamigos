/**
 * Template genérico: inventário de desenvolvimento de 0 a 6 anos por áreas
 * e faixas etárias (estrutura tipo Portage/IPO).
 *
 * A ESTRUTURA (área de estimulação infantil nos primeiros meses + 5 áreas de
 * desenvolvimento por faixa etária anual, escala de 3 pontos) segue
 * descrições públicas do instrumento. O TEXTO de cada item é ORIGINAL,
 * escrito para esta aplicação — nenhum item foi copiado ou parafraseado do
 * Portage Guide, do Inventário Portage Operacionalizado (Williams & Aiello)
 * nem de suas traduções. Não usar a marca como nome de produto.
 *
 * Fonte da estrutura:
 * - https://www.scielo.br/j/ptp/a/3rVq94JJ3VjY6qYXYFKvBZb/?lang=pt
 */
import type { ProtocolTemplate } from "./types";

export const ipoTemplate: ProtocolTemplate = {
  name: "ipo",
  displayName:
    "Desenvolvimento 0-6 anos por áreas (estrutura tipo Portage/IPO, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: {
      0: "Não realiza",
      1: "Em aquisição",
      2: "Adquirido",
    },
  },
  contentLicense: "original",
  sources: ["https://www.scielo.br/j/ptp/a/3rVq94JJ3VjY6qYXYFKvBZb/?lang=pt"],
  notes:
    "O inventário original tem 580 itens; este template traz 6 comportamentos representativos por área e faixa etária. Complete pelo importador em massa.",
  domains: [
    // ------------------------------------------------------------------
    // 0-4 meses: Estimulação infantil
    // ------------------------------------------------------------------
    {
      level: "0-4 meses",
      domain: "Estimulação infantil",
      items: [
        { code: "0-4-EST-01", description: "Fixa o olhar no rosto do adulto a cerca de 20 a 30 centímetros de distância." },
        { code: "0-4-EST-02", description: "Acalma-se ao ouvir a voz do cuidador ou ao ser pego no colo." },
        { code: "0-4-EST-03", description: "Segue com os olhos um objeto colorido movido lentamente de um lado ao outro." },
        { code: "0-4-EST-04", description: "Vira a cabeça em direção a um som suave, como um chocalho, fora do campo visual." },
        { code: "0-4-EST-05", description: "Sorri em resposta ao sorriso, à voz ou ao toque do adulto." },
        { code: "0-4-EST-06", description: "Levanta a cabeça e o peito apoiando-se nos antebraços quando deitado de bruços." },
        { code: "0-4-EST-07", description: "Segura por alguns segundos um objeto leve colocado em sua mão." },
        { code: "0-4-EST-08", description: "Emite sons vocálicos e gorgolejos ao interagir com o adulto." },
      ],
    },

    // ------------------------------------------------------------------
    // 0-1 ano
    // ------------------------------------------------------------------
    {
      level: "0-1 ano",
      domain: "Desenvolvimento motor",
      items: [
        { code: "0-1-MOT-01", description: "Rola de bruços para de costas e de costas para bruços sem ajuda." },
        { code: "0-1-MOT-02", description: "Senta-se sem apoio por vários minutos mantendo o tronco firme." },
        { code: "0-1-MOT-03", description: "Pega um objeto pequeno usando o polegar e o indicador em pinça." },
        { code: "0-1-MOT-04", description: "Engatinha ou se desloca pelo chão para alcançar um brinquedo." },
        { code: "0-1-MOT-05", description: "Fica em pé segurando em móveis e dá passos laterais com apoio." },
        { code: "0-1-MOT-06", description: "Dá alguns passos sozinho ou segurando na mão do adulto." },
      ],
    },
    {
      level: "0-1 ano",
      domain: "Linguagem",
      items: [
        { code: "0-1-LIN-01", description: "Vira a cabeça em direção à voz de quem fala com ele." },
        { code: "0-1-LIN-02", description: "Balbucia sílabas repetidas, como 'bababa' ou 'dadada', quando está sozinho ou em interação." },
        { code: "0-1-LIN-03", description: "Olha para o adulto quando ouve o próprio nome." },
        { code: "0-1-LIN-04", description: "Vocaliza em resposta à fala do adulto, como se conversasse." },
        { code: "0-1-LIN-05", description: "Responde a 'não' ou 'tchau' interrompendo a ação ou acenando." },
        { code: "0-1-LIN-06", description: "Diz uma ou duas palavras com significado, como 'mamã' ou 'dá'." },
      ],
    },
    {
      level: "0-1 ano",
      domain: "Cognição",
      items: [
        { code: "0-1-COG-01", description: "Segue com o olhar um objeto que cai ou desaparece atrás de algo." },
        { code: "0-1-COG-02", description: "Leva objetos à boca e os explora virando e batendo." },
        { code: "0-1-COG-03", description: "Procura um brinquedo parcialmente coberto por um pano." },
        { code: "0-1-COG-04", description: "Bate dois objetos um contra o outro ao segurá-los." },
        { code: "0-1-COG-05", description: "Encontra um brinquedo totalmente escondido sob um pano após ver onde foi colocado." },
        { code: "0-1-COG-06", description: "Retira objetos de um recipiente e os coloca de volta." },
      ],
    },
    {
      level: "0-1 ano",
      domain: "Socialização",
      items: [
        { code: "0-1-SOC-01", description: "Sorri e movimenta o corpo ao ver um rosto familiar." },
        { code: "0-1-SOC-02", description: "Estende os braços para ser pego no colo pelo cuidador." },
        { code: "0-1-SOC-03", description: "Diferencia pessoas familiares de estranhas, reagindo de forma distinta." },
        { code: "0-1-SOC-04", description: "Participa de brincadeiras como esconde-esconde, rindo e antecipando." },
        { code: "0-1-SOC-05", description: "Imita gestos sociais como bater palmas ou acenar." },
        { code: "0-1-SOC-06", description: "Oferece um brinquedo ao adulto quando solicitado, mesmo sem soltá-lo." },
      ],
    },
    {
      level: "0-1 ano",
      domain: "Autocuidados",
      items: [
        { code: "0-1-AUT-01", description: "Suga e engole líquidos da mamadeira ou do peito sem dificuldade." },
        { code: "0-1-AUT-02", description: "Aceita alimentos pastosos oferecidos com colher, engolindo sem empurrar com a língua." },
        { code: "0-1-AUT-03", description: "Segura a mamadeira ou o copo com as duas mãos durante a alimentação." },
        { code: "0-1-AUT-04", description: "Come pedaços pequenos e macios de alimento com as mãos." },
        { code: "0-1-AUT-05", description: "Bebe de um copo segurado pelo adulto com pouco derramamento." },
        { code: "0-1-AUT-06", description: "Colabora ao ser vestido, estendendo braços ou pernas." },
      ],
    },

    // ------------------------------------------------------------------
    // 1-2 anos
    // ------------------------------------------------------------------
    {
      level: "1-2 anos",
      domain: "Desenvolvimento motor",
      items: [
        { code: "1-2-MOT-01", description: "Anda sozinho pela sala sem cair com frequência." },
        { code: "1-2-MOT-02", description: "Abaixa-se para pegar um objeto do chão e levanta sem apoio." },
        { code: "1-2-MOT-03", description: "Empilha três ou quatro blocos formando uma torre." },
        { code: "1-2-MOT-04", description: "Sobe escadas com apoio da mão do adulto ou do corrimão." },
        { code: "1-2-MOT-05", description: "Chuta uma bola parada sem perder o equilíbrio." },
        { code: "1-2-MOT-06", description: "Faz rabiscos no papel segurando o giz ou lápis." },
      ],
    },
    {
      level: "1-2 anos",
      domain: "Linguagem",
      items: [
        { code: "1-2-LIN-01", description: "Aponta para objetos ou figuras nomeadas pelo adulto." },
        { code: "1-2-LIN-02", description: "Segue instruções simples de um passo, como 'pega a bola'." },
        { code: "1-2-LIN-03", description: "Usa 10 ou mais palavras de forma espontânea." },
        { code: "1-2-LIN-04", description: "Nomeia objetos familiares quando perguntado 'o que é isso?'." },
        { code: "1-2-LIN-05", description: "Aponta partes do corpo quando nomeadas, como nariz e olhos." },
        { code: "1-2-LIN-06", description: "Combina duas palavras em frases curtas, como 'quer água'." },
      ],
    },
    {
      level: "1-2 anos",
      domain: "Cognição",
      items: [
        { code: "1-2-COG-01", description: "Encaixa uma peça redonda em um tabuleiro de formas." },
        { code: "1-2-COG-02", description: "Pareia objetos iguais quando o adulto oferece dois pares diferentes." },
        { code: "1-2-COG-03", description: "Aciona um brinquedo de causa e efeito, como apertar um botão para acender luz." },
        { code: "1-2-COG-04", description: "Pareia objetos de mesma cor entre três cores diferentes." },
        { code: "1-2-COG-05", description: "Monta um quebra-cabeça de encaixe com 3 ou 4 peças com pino." },
        { code: "1-2-COG-06", description: "Aponta figuras de animais e objetos em um livro quando o adulto pergunta." },
      ],
    },
    {
      level: "1-2 anos",
      domain: "Socialização",
      items: [
        { code: "1-2-SOC-01", description: "Imita ações simples do adulto durante tarefas do cotidiano." },
        { code: "1-2-SOC-02", description: "Cumprimenta e se despede com gesto ou palavra." },
        { code: "1-2-SOC-03", description: "Brinca ao lado de outra criança com materiais semelhantes." },
        { code: "1-2-SOC-04", description: "Mostra objetos ao adulto para compartilhar interesse, olhando para o seu rosto." },
        { code: "1-2-SOC-05", description: "Demonstra afeto com abraços ou beijos em pessoas familiares." },
        { code: "1-2-SOC-06", description: "Ajuda em tarefas simples quando solicitado, como guardar brinquedos." },
      ],
    },
    {
      level: "1-2 anos",
      domain: "Autocuidados",
      items: [
        { code: "1-2-AUT-01", description: "Come com colher sozinho, ainda que derrame parte do alimento." },
        { code: "1-2-AUT-02", description: "Bebe de um copo sem tampa segurando com as duas mãos." },
        { code: "1-2-AUT-03", description: "Tira meias e sapatos abertos sozinho quando o adulto pede." },
        { code: "1-2-AUT-04", description: "Indica com gesto ou palavra que a fralda está suja." },
        { code: "1-2-AUT-05", description: "Aceita ter o rosto e as mãos limpos pelo adulto." },
        { code: "1-2-AUT-06", description: "Leva o copo ou prato à mesa quando solicitado." },
      ],
    },

    // ------------------------------------------------------------------
    // 2-3 anos
    // ------------------------------------------------------------------
    {
      level: "2-3 anos",
      domain: "Desenvolvimento motor",
      items: [
        { code: "2-3-MOT-01", description: "Corre com fluidez pela sala e para ao sinal do adulto sem cair." },
        { code: "2-3-MOT-02", description: "Pula no lugar com os dois pés saindo do chão." },
        { code: "2-3-MOT-03", description: "Sobe escadas alternando os pés com apoio leve." },
        { code: "2-3-MOT-04", description: "Empilha 6 ou mais blocos formando uma torre." },
        { code: "2-3-MOT-05", description: "Enfia contas grandes em um cordão rígido ou fio grosso." },
        { code: "2-3-MOT-06", description: "Copia linhas verticais e círculos após modelo do adulto." },
      ],
    },
    {
      level: "2-3 anos",
      domain: "Linguagem",
      items: [
        { code: "2-3-LIN-01", description: "Segue instruções de dois passos relacionados, como 'pega o copo e coloca na mesa'." },
        { code: "2-3-LIN-02", description: "Usa frases de três palavras para pedir e comentar." },
        { code: "2-3-LIN-03", description: "Nomeia ações em figuras, como 'comendo' ou 'dormindo'." },
        { code: "2-3-LIN-04", description: "Responde a perguntas 'o que é?' e 'onde está?' com palavras." },
        { code: "2-3-LIN-05", description: "Usa pronomes como 'eu', 'meu' e 'você' na conversa." },
        { code: "2-3-LIN-06", description: "Faz perguntas simples com 'o quê?' e 'onde?'." },
      ],
    },
    {
      level: "2-3 anos",
      domain: "Cognição",
      items: [
        { code: "2-3-COG-01", description: "Encaixa círculo, quadrado e triângulo em um tabuleiro de formas." },
        { code: "2-3-COG-02", description: "Separa objetos por tamanho, grandes e pequenos, em dois grupos." },
        { code: "2-3-COG-03", description: "Pareia figuras iguais em um jogo de memória com 4 pares." },
        { code: "2-3-COG-04", description: "Monta um quebra-cabeça de 4 a 6 peças interligadas." },
        { code: "2-3-COG-05", description: "Conta até 3 objetos apontando para cada um." },
        { code: "2-3-COG-06", description: "Agrupa objetos por categoria, como animais e alimentos." },
      ],
    },
    {
      level: "2-3 anos",
      domain: "Socialização",
      items: [
        { code: "2-3-SOC-01", description: "Reveza a vez em uma brincadeira simples com apoio do adulto." },
        { code: "2-3-SOC-02", description: "Faz de conta com bonecos, como dar comida ou colocar para dormir." },
        { code: "2-3-SOC-03", description: "Chama outra criança pelo nome para iniciar uma brincadeira." },
        { code: "2-3-SOC-04", description: "Responde a pedidos de outra criança, como entregar um brinquedo." },
        { code: "2-3-SOC-05", description: "Reconhece emoções básicas, como feliz e triste, em rostos e figuras." },
        { code: "2-3-SOC-06", description: "Participa de uma roda de música com outras crianças por alguns minutos." },
      ],
    },
    {
      level: "2-3 anos",
      domain: "Autocuidados",
      items: [
        { code: "2-3-AUT-01", description: "Come com garfo e colher sem derramar em excesso." },
        { code: "2-3-AUT-02", description: "Bebe de um copo aberto com uma mão." },
        { code: "2-3-AUT-03", description: "Veste calça com elástico e camiseta com ajuda mínima." },
        { code: "2-3-AUT-04", description: "Lava e seca as mãos sozinho após lembrete." },
        { code: "2-3-AUT-05", description: "Avisa que precisa usar o banheiro e senta no vaso com apoio." },
        { code: "2-3-AUT-06", description: "Escova os dentes com apoio do adulto para finalizar." },
      ],
    },

    // ------------------------------------------------------------------
    // 3-4 anos
    // ------------------------------------------------------------------
    {
      level: "3-4 anos",
      domain: "Desenvolvimento motor",
      items: [
        { code: "3-4-MOT-01", description: "Fica em um pé só por 3 a 5 segundos sem apoio." },
        { code: "3-4-MOT-02", description: "Pedala um triciclo por vários metros controlando a direção." },
        { code: "3-4-MOT-03", description: "Pega uma bola média lançada de perto com as duas mãos." },
        { code: "3-4-MOT-04", description: "Corta com tesoura infantil seguindo uma linha reta desenhada no papel." },
        { code: "3-4-MOT-05", description: "Copia uma cruz e um quadrado após modelo." },
        { code: "3-4-MOT-06", description: "Desenha uma pessoa com pelo menos três partes do corpo." },
      ],
    },
    {
      level: "3-4 anos",
      domain: "Linguagem",
      items: [
        { code: "3-4-LIN-01", description: "Segue instruções de três passos não relacionados sem apoio gestual." },
        { code: "3-4-LIN-02", description: "Usa frases de quatro ou mais palavras com verbo e complemento." },
        { code: "3-4-LIN-03", description: "Faz perguntas com 'por quê?' e 'quando?' para obter informação." },
        { code: "3-4-LIN-04", description: "Conta um evento recente de forma compreensível para o adulto." },
        { code: "3-4-LIN-05", description: "Usa verbos no passado e no futuro em frases espontâneas." },
        { code: "3-4-LIN-06", description: "Mantém uma conversa sobre um tema por três ou mais turnos." },
      ],
    },
    {
      level: "3-4 anos",
      domain: "Cognição",
      items: [
        { code: "3-4-COG-01", description: "Nomeia 4 ou mais cores e as formas círculo, quadrado e triângulo." },
        { code: "3-4-COG-02", description: "Conta até 10 objetos apontando um por um." },
        { code: "3-4-COG-03", description: "Entrega a quantidade pedida de objetos, até 5." },
        { code: "3-4-COG-04", description: "Compara objetos por atributos, como 'maior' e 'mais comprido'." },
        { code: "3-4-COG-05", description: "Organiza figuras de uma sequência de três eventos na ordem correta." },
        { code: "3-4-COG-06", description: "Reconhece algumas letras, como as do próprio nome." },
      ],
    },
    {
      level: "3-4 anos",
      domain: "Socialização",
      items: [
        { code: "3-4-SOC-01", description: "Convida outra criança para brincar usando palavras, sem precisar do adulto." },
        { code: "3-4-SOC-02", description: "Assume um papel em brincadeiras de faz de conta com outras crianças." },
        { code: "3-4-SOC-03", description: "Reveza a vez em jogos simples sem apoio constante do adulto." },
        { code: "3-4-SOC-04", description: "Segue as regras de um jogo em grupo explicadas pelo adulto." },
        { code: "3-4-SOC-05", description: "Oferece ajuda ou conforto a uma criança que está triste." },
        { code: "3-4-SOC-06", description: "Participa de atividade em grupo com 4 ou mais crianças por 10 minutos." },
      ],
    },
    {
      level: "3-4 anos",
      domain: "Autocuidados",
      items: [
        { code: "3-4-AUT-01", description: "Serve-se de alimentos com colher grande sem derramar." },
        { code: "3-4-AUT-02", description: "Veste e despe roupas com fechos simples de forma independente." },
        { code: "3-4-AUT-03", description: "Usa o banheiro de forma independente, incluindo abaixar e levantar a roupa." },
        { code: "3-4-AUT-04", description: "Lava o rosto e as mãos sozinho antes das refeições." },
        { code: "3-4-AUT-05", description: "Abotoa e desabotoa botões médios do próprio casaco sem ajuda." },
        { code: "3-4-AUT-06", description: "Guarda os próprios brinquedos no lugar combinado ao fim da brincadeira." },
      ],
    },

    // ------------------------------------------------------------------
    // 4-5 anos
    // ------------------------------------------------------------------
    {
      level: "4-5 anos",
      domain: "Desenvolvimento motor",
      items: [
        { code: "4-5-MOT-01", description: "Pula com um pé só por vários saltos consecutivos." },
        { code: "4-5-MOT-02", description: "Desce escadas alternando os pés sem segurar no corrimão." },
        { code: "4-5-MOT-03", description: "Arremessa uma bola em direção a um alvo com precisão razoável." },
        { code: "4-5-MOT-04", description: "Corta com tesoura seguindo uma linha curva e formas simples." },
        { code: "4-5-MOT-05", description: "Copia um triângulo e algumas letras maiúsculas após modelo do adulto." },
        { code: "4-5-MOT-06", description: "Escreve o próprio nome de forma reconhecível sem copiar de um modelo." },
      ],
    },
    {
      level: "4-5 anos",
      domain: "Linguagem",
      items: [
        { code: "4-5-LIN-01", description: "Compreende conceitos de tempo, como 'ontem', 'hoje' e 'amanhã'." },
        { code: "4-5-LIN-02", description: "Fala de forma inteligível para pessoas não familiares." },
        { code: "4-5-LIN-03", description: "Reconta uma história curta com começo, meio e fim." },
        { code: "4-5-LIN-04", description: "Descreve a função de objetos comuns, como 'a tesoura serve para cortar'." },
        { code: "4-5-LIN-05", description: "Usa frases compostas com 'porque', 'mas' e 'então'." },
        { code: "4-5-LIN-06", description: "Responde a perguntas sobre uma história ouvida, incluindo 'por quê'." },
      ],
    },
    {
      level: "4-5 anos",
      domain: "Cognição",
      items: [
        { code: "4-5-COG-01", description: "Nomeia 8 ou mais cores e formas como retângulo e losango." },
        { code: "4-5-COG-02", description: "Conta até 20 e reconhece os números de 1 a 10." },
        { code: "4-5-COG-03", description: "Ordena objetos do menor ao maior em uma série de 5." },
        { code: "4-5-COG-04", description: "Completa padrões simples, como sequência de duas cores alternadas." },
        { code: "4-5-COG-05", description: "Reconhece a maioria das letras do alfabeto quando o adulto as mostra." },
        { code: "4-5-COG-06", description: "Diz o que falta em uma figura incompleta, como um rosto sem nariz." },
      ],
    },
    {
      level: "4-5 anos",
      domain: "Socialização",
      items: [
        { code: "4-5-SOC-01", description: "Combina com outra criança quem faz o quê na brincadeira." },
        { code: "4-5-SOC-02", description: "Negocia com palavras o uso de um brinquedo disputado." },
        { code: "4-5-SOC-03", description: "Participa de brincadeiras cooperativas com objetivo comum, como construir juntos." },
        { code: "4-5-SOC-04", description: "Joga jogos de tabuleiro simples respeitando as regras." },
        { code: "4-5-SOC-05", description: "Pede desculpas ou repara quando percebe que magoou alguém." },
        { code: "4-5-SOC-06", description: "Tem uma ou mais crianças preferidas para brincar e as procura." },
      ],
    },
    {
      level: "4-5 anos",
      domain: "Autocuidados",
      items: [
        { code: "4-5-AUT-01", description: "Usa garfo e faca para cortar alimentos macios." },
        { code: "4-5-AUT-02", description: "Veste-se sozinho, incluindo botões e zíperes, sem ajuda do adulto." },
        { code: "4-5-AUT-03", description: "Escova os dentes sozinho, com supervisão apenas para conferir." },
        { code: "4-5-AUT-04", description: "Toma banho com ajuda apenas para lavar o cabelo." },
        { code: "4-5-AUT-05", description: "Calça sapatos no pé certo e fecha o velcro." },
        { code: "4-5-AUT-06", description: "Assoa o nariz com lenço quando lembrado pelo adulto." },
      ],
    },

    // ------------------------------------------------------------------
    // 5-6 anos
    // ------------------------------------------------------------------
    {
      level: "5-6 anos",
      domain: "Desenvolvimento motor",
      items: [
        { code: "5-6-MOT-01", description: "Pula corda ou salta alternando os pés em ritmo." },
        { code: "5-6-MOT-02", description: "Anda sobre uma trave baixa mantendo o equilíbrio por vários passos." },
        { code: "5-6-MOT-03", description: "Quica uma bola e a pega com as mãos várias vezes seguidas." },
        { code: "5-6-MOT-04", description: "Copia um losango e desenhos simples com detalhes após modelo." },
        { code: "5-6-MOT-05", description: "Escreve letras e números dentro de linhas com tamanho regular." },
        { code: "5-6-MOT-06", description: "Amarra um laço simples no cadarço com apoio verbal do adulto." },
      ],
    },
    {
      level: "5-6 anos",
      domain: "Linguagem",
      items: [
        { code: "5-6-LIN-01", description: "Segue instruções com três ou mais partes dadas ao grupo." },
        { code: "5-6-LIN-02", description: "Conta histórias inventadas com personagens e sequência lógica." },
        { code: "5-6-LIN-03", description: "Define palavras simples pela função ou categoria quando perguntado." },
        { code: "5-6-LIN-04", description: "Identifica o som inicial de palavras faladas pelo adulto." },
        { code: "5-6-LIN-05", description: "Usa frases complexas com concordância verbal e nominal." },
        { code: "5-6-LIN-06", description: "Explica regras de um jogo para outra criança." },
      ],
    },
    {
      level: "5-6 anos",
      domain: "Cognição",
      items: [
        { code: "5-6-COG-01", description: "Conta até 50 e reconhece números até 20." },
        { code: "5-6-COG-02", description: "Faz somas simples com objetos concretos, com resultado até 10." },
        { code: "5-6-COG-03", description: "Escreve o próprio nome e algumas palavras simples." },
        { code: "5-6-COG-04", description: "Diz os dias da semana em ordem quando solicitado." },
        { code: "5-6-COG-05", description: "Classifica objetos por dois atributos ao mesmo tempo, como cor e forma." },
        { code: "5-6-COG-06", description: "Reconhece direita e esquerda em si mesmo quando solicitado." },
      ],
    },
    {
      level: "5-6 anos",
      domain: "Socialização",
      items: [
        { code: "5-6-SOC-01", description: "Brinca em grupo seguindo regras combinadas sem supervisão constante." },
        { code: "5-6-SOC-02", description: "Resolve conflitos com pares por meio de conversa, com pouca mediação." },
        { code: "5-6-SOC-03", description: "Espera a vez em fila e em atividades de grupo." },
        { code: "5-6-SOC-04", description: "Consola um colega triste e nomeia os sentimentos de outras pessoas." },
        { code: "5-6-SOC-05", description: "Cumpre pequenas responsabilidades combinadas em casa ou na escola." },
        { code: "5-6-SOC-06", description: "Participa de jogos competitivos aceitando ganhar e perder." },
      ],
    },
    {
      level: "5-6 anos",
      domain: "Autocuidados",
      items: [
        { code: "5-6-AUT-01", description: "Prepara um lanche simples, como passar manteiga no pão." },
        { code: "5-6-AUT-02", description: "Escolhe roupas adequadas ao clima e se veste sozinho." },
        { code: "5-6-AUT-03", description: "Toma banho sozinho com supervisão do adulto à distância." },
        { code: "5-6-AUT-04", description: "Penteia o cabelo e cuida da aparência com lembrete." },
        { code: "5-6-AUT-05", description: "Atravessa a rua com o adulto olhando para os dois lados." },
        { code: "5-6-AUT-06", description: "Sabe dizer o nome completo, idade e nome dos pais." },
      ],
    },
  ],
};

export default ipoTemplate;
