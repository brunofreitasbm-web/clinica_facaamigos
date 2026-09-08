/**
 * Template genérico de linguagem básica e aprendizagem (estrutura tipo ABLLS-R).
 *
 * Estrutura (25 áreas A–Y) obtida de descrições públicas do instrumento.
 * O TEXTO DOS ITENS É ORIGINAL: nenhuma frase foi copiada ou parafraseada do
 * protocolo ABLLS-R nem de traduções (autorizadas ou não). Cada área traz 8
 * habilidades representativas em ordem crescente de complexidade.
 *
 * Fontes da estrutura:
 * - https://en.wikipedia.org/wiki/Assessment_of_basic_language_and_learning_skills
 * - https://www.abaresourcecenter.com/post/what-is-the-ablls-r
 */
import type { ProtocolTemplate } from "./types";

export const abllsRTemplate: ProtocolTemplate = {
  name: "ablls_r",
  displayName: "Linguagem básica e aprendizagem (estrutura tipo ABLLS-R, genérico)",
  version: "1.0",
  scale: {
    max: 4,
    labels: {
      0: "Ausente",
      1: "Inicial",
      2: "Parcial",
      3: "Quase independente",
      4: "Independente",
    },
  },
  contentLicense: "original",
  sources: [
    "https://en.wikipedia.org/wiki/Assessment_of_basic_language_and_learning_skills",
    "https://www.abaresourcecenter.com/post/what-is-the-ablls-r",
  ],
  notes:
    "O instrumento original tem 544 itens; este template traz 8 habilidades representativas por área, em ordem crescente de complexidade. Complete com itens próprios pelo importador em massa.",
  domains: [
    {
      domain: "A. Cooperação e efetividade de reforçadores",
      items: [
        { code: "A01", description: "Aceita um item preferido oferecido pelo terapeuta sem se afastar ou protestar." },
        { code: "A02", description: "Permanece sentado à mesa por dois minutos enquanto interage com materiais preferidos." },
        { code: "A03", description: "Olha para o terapeuta quando um reforçador é apresentado e o alcança com a mão." },
        { code: "A04", description: "Entrega um item preferido ao terapeuta quando solicitado, sem apresentar comportamento de fuga." },
        { code: "A05", description: "Realiza uma tarefa simples solicitada para ter acesso a um reforçador logo em seguida." },
        { code: "A06", description: "Trabalha em três tarefas consecutivas antes de receber o reforçador, sem comportamento problema." },
        { code: "A07", description: "Aceita reforçadores variados (sociais, tangíveis e comestíveis) apresentados pelo terapeuta em sessões diferentes." },
        { code: "A08", description: "Mantém-se engajado em atividade de dez minutos com reforço social intermitente, sem itens tangíveis." },
      ],
    },
    {
      domain: "B. Desempenho visual",
      items: [
        { code: "B01", description: "Encaixa uma peça grande em tabuleiro de encaixe com um único orifício." },
        { code: "B02", description: "Pareia objetos idênticos entre um conjunto de três alternativas apresentadas na mesa." },
        { code: "B03", description: "Pareia figuras idênticas entre um conjunto de quatro alternativas apresentadas na mesa." },
        { code: "B04", description: "Pareia figura ao objeto correspondente entre três alternativas apresentadas." },
        { code: "B05", description: "Classifica objetos por cor em caixas separadas com até três cores diferentes." },
        { code: "B06", description: "Monta quebra-cabeça de seis peças com encaixe entre as peças, sem ajuda física." },
        { code: "B07", description: "Completa sequência de padrão simples com blocos (ex.: azul, vermelho, azul, vermelho)." },
        { code: "B08", description: "Reproduz construção de blocos com até oito peças a partir de modelo tridimensional." },
      ],
    },
    {
      domain: "C. Linguagem receptiva",
      items: [
        { code: "C01", description: "Vira-se ou olha na direção da pessoa quando seu nome é chamado." },
        { code: "C02", description: "Segue instrução de um passo acompanhada de gesto de apoio (ex.: \"senta\", \"vem\")." },
        { code: "C03", description: "Segue instrução de um passo sem gesto de apoio, em contexto de mesa." },
        { code: "C04", description: "Toca ou aponta partes do corpo nomeadas pelo terapeuta, ao menos seis partes diferentes." },
        { code: "C05", description: "Seleciona figura nomeada entre um conjunto de seis alternativas apresentadas." },
        { code: "C06", description: "Seleciona item por função ou característica descrita (ex.: \"qual serve para cortar?\")." },
        { code: "C07", description: "Segue instruções de dois passos não relacionados (ex.: \"pegue o copo e feche a porta\")." },
        { code: "C08", description: "Segue instruções com preposições e adjetivos combinados (ex.: \"ponha o bloco grande embaixo da mesa\")." },
      ],
    },
    {
      domain: "D. Imitação motora",
      items: [
        { code: "D01", description: "Imita ação com objeto logo após demonstração do terapeuta (ex.: bater no tambor)." },
        { code: "D02", description: "Imita ação motora grossa simples (ex.: bater palmas, levantar os braços)." },
        { code: "D03", description: "Imita movimento motor fino visível (ex.: abrir e fechar a mão, apontar)." },
        { code: "D04", description: "Imita movimento orofacial demonstrado (ex.: abrir a boca, mostrar a língua)." },
        { code: "D05", description: "Imita sequência de duas ações apresentadas juntas pelo terapeuta, na mesma ordem." },
        { code: "D06", description: "Imita ações do terapeuta em pé e à distância, fora do contexto de mesa." },
        { code: "D07", description: "Imita sequência de três ações apresentadas juntas, mantendo a ordem." },
        { code: "D08", description: "Imita ações de um par durante brincadeira sem instrução do adulto." },
      ],
    },
    {
      domain: "E. Imitação vocal",
      items: [
        { code: "E01", description: "Vocaliza em resposta a vocalização do adulto durante interação lúdica." },
        { code: "E02", description: "Imita som isolado de vogal apresentado pelo terapeuta (ex.: \"a\", \"o\")." },
        { code: "E03", description: "Imita sílaba consoante-vogal apresentada pelo terapeuta (ex.: \"ba\", \"ma\")." },
        { code: "E04", description: "Imita palavra de duas sílabas com aproximação inteligível." },
        { code: "E05", description: "Imita palavra de três ou mais sílabas com todos os sons corretos." },
        { code: "E06", description: "Imita sequência de duas palavras apresentadas juntas pelo terapeuta." },
        { code: "E07", description: "Imita frase curta de quatro palavras mantendo a ordem das palavras." },
        { code: "E08", description: "Imita variações de entonação, volume e ritmo em frases curtas." },
      ],
    },
    {
      domain: "F. Pedidos (mandos)",
      items: [
        { code: "F01", description: "Alcança ou puxa o adulto em direção a item desejado que está fora de alcance." },
        { code: "F02", description: "Pede item desejado por gesto, figura ou palavra quando o item está visível." },
        { code: "F03", description: "Pede item desejado que não está visível, com repertório de pelo menos dez itens." },
        { code: "F04", description: "Pede ajuda de forma espontânea diante de dificuldade (ex.: pote fechado)." },
        { code: "F05", description: "Pede para interromper ou remover atividade desagradável de forma apropriada." },
        { code: "F06", description: "Faz pedidos usando frases de duas ou mais palavras (ex.: \"quero bola\")." },
        { code: "F07", description: "Pede informação com perguntas simples (ex.: \"onde está?\", \"o que é?\")." },
        { code: "F08", description: "Pede que outra pessoa realize uma ação específica, usando frase completa." },
      ],
    },
    {
      domain: "G. Nomeação (tatos)",
      items: [
        { code: "G01", description: "Nomeia ao menos cinco objetos familiares quando perguntado \"o que é?\"." },
        { code: "G02", description: "Nomeia ao menos vinte figuras de objetos comuns do cotidiano." },
        { code: "G03", description: "Nomeia ações em andamento ou em figuras (ex.: \"correndo\", \"comendo\")." },
        { code: "G04", description: "Nomeia cores, formas e tamanhos de objetos apresentados pelo terapeuta." },
        { code: "G05", description: "Nomeia partes de objetos e do corpo (ex.: roda do carro, cotovelo)." },
        { code: "G06", description: "Nomeia a categoria de um objeto quando perguntado (ex.: \"isso é uma fruta\")." },
        { code: "G07", description: "Descreve figuras com frases completas incluindo sujeito, ação e objeto." },
        { code: "G08", description: "Nomeia sons, cheiros, texturas e sensações internas sem pista visual." },
      ],
    },
    {
      domain: "H. Intraverbais",
      items: [
        { code: "H01", description: "Completa canção ou rima familiar com a palavra final quando o adulto pausa." },
        { code: "H02", description: "Completa frases de associação simples (ex.: \"o cachorro faz...\")." },
        { code: "H03", description: "Responde perguntas sociais básicas (nome, idade, nome dos pais)." },
        { code: "H04", description: "Nomeia ao menos três itens de uma categoria quando solicitado (ex.: animais)." },
        { code: "H05", description: "Responde perguntas sobre função de objetos sem o objeto presente." },
        { code: "H06", description: "Responde perguntas com \"quem\", \"onde\" e \"quando\" sobre rotinas conhecidas." },
        { code: "H07", description: "Responde perguntas sobre história curta ouvida há poucos minutos." },
        { code: "H08", description: "Mantém conversa sobre tema de interesse com pelo menos cinco trocas de turno." },
      ],
    },
    {
      domain: "I. Vocalizações espontâneas",
      items: [
        { code: "I01", description: "Produz vocalizações variadas durante brincadeira livre, sem instrução do adulto." },
        { code: "I02", description: "Produz sílabas repetidas (ex.: \"mamama\") ao longo do dia em contextos diferentes." },
        { code: "I03", description: "Produz aproximações de palavras de forma espontânea em contexto apropriado." },
        { code: "I04", description: "Diz palavras isoladas de forma espontânea para comentar sobre o ambiente." },
        { code: "I05", description: "Produz combinações de duas palavras de forma espontânea ao longo do dia." },
        { code: "I06", description: "Comenta espontaneamente sobre eventos enquanto brinca (ex.: \"caiu!\")." },
        { code: "I07", description: "Canta trechos de músicas conhecidas sem que seja solicitado." },
        { code: "I08", description: "Inicia conversa espontaneamente com frases completas sobre eventos recentes." },
      ],
    },
    {
      domain: "J. Sintaxe e gramática",
      items: [
        { code: "J01", description: "Combina duas palavras em frase simples (ex.: \"mais suco\")." },
        { code: "J02", description: "Usa frases de três palavras com sujeito, verbo e objeto." },
        { code: "J03", description: "Usa plural regular de forma correta ao falar de vários objetos." },
        { code: "J04", description: "Usa pronomes pessoais \"eu\", \"você\" e \"ele/ela\" de forma adequada." },
        { code: "J05", description: "Usa preposições como \"em\", \"sobre\" e \"embaixo\" em frases espontâneas." },
        { code: "J06", description: "Usa verbos no passado e no futuro de forma correta em frases espontâneas." },
        { code: "J07", description: "Usa artigos e concordância de gênero e número em frases de cinco ou mais palavras." },
        { code: "J08", description: "Constrói frases compostas com conectivos como \"porque\", \"mas\" e \"quando\"." },
      ],
    },
    {
      domain: "K. Brincar e lazer",
      items: [
        { code: "K01", description: "Explora brinquedos de causa e efeito de forma apropriada por dois minutos." },
        { code: "K02", description: "Brinca de forma funcional com ao menos cinco brinquedos diferentes." },
        { code: "K03", description: "Engaja-se em brincadeira independente por dez minutos sem supervisão direta." },
        { code: "K04", description: "Realiza brincadeira simbólica simples com bonecos ou miniaturas (ex.: dar comida)." },
        { code: "K05", description: "Participa de jogo de tabuleiro simples respeitando turnos com um par." },
        { code: "K06", description: "Brinca no parquinho usando equipamentos variados de forma segura." },
        { code: "K07", description: "Cria enredo de faz de conta com sequência de três ou mais ações." },
        { code: "K08", description: "Escolhe e organiza atividade de lazer sozinho durante o tempo livre." },
      ],
    },
    {
      domain: "L. Interação social",
      items: [
        { code: "L01", description: "Mantém contato visual com adulto durante interação lúdica por alguns segundos." },
        { code: "L02", description: "Responde a cumprimentos de adultos e pares com gesto ou palavra." },
        { code: "L03", description: "Aproxima-se de pares para brincar ao lado deles com o mesmo material." },
        { code: "L04", description: "Cumprimenta espontaneamente pares e adultos ao chegar e ao sair." },
        { code: "L05", description: "Oferece ou compartilha brinquedo com um par quando solicitado." },
        { code: "L06", description: "Inicia interação com um par convidando-o para brincar de forma espontânea." },
        { code: "L07", description: "Mantém brincadeira cooperativa com par por dez minutos, alternando papéis." },
        { code: "L08", description: "Ajusta o próprio comportamento conforme expressões e pistas sociais dos pares." },
      ],
    },
    {
      domain: "M. Instrução em grupo",
      items: [
        { code: "M01", description: "Permanece sentado em grupo pequeno por cinco minutos durante atividade dirigida." },
        { code: "M02", description: "Segue instrução dada ao grupo quando o terapeuta está próximo." },
        { code: "M03", description: "Responde quando seu nome é chamado durante atividade em grupo." },
        { code: "M04", description: "Segue instrução dada ao grupo sem ajuda individual ou repetição." },
        { code: "M05", description: "Responde a perguntas dirigidas ao grupo aguardando a sua vez." },
        { code: "M06", description: "Imita ações demonstradas ao grupo durante música ou circuito." },
        { code: "M07", description: "Realiza atividade acadêmica em grupo de cinco crianças com instrução única." },
        { code: "M08", description: "Aprende habilidade nova observando a resposta de outros membros do grupo." },
      ],
    },
    {
      domain: "N. Rotinas de sala de aula",
      items: [
        { code: "N01", description: "Entra na sala e guarda a mochila no local combinado com ajuda verbal." },
        { code: "N02", description: "Senta-se no lugar indicado quando solicitado no início da atividade." },
        { code: "N03", description: "Transita entre atividades quando avisado, sem comportamento problema." },
        { code: "N04", description: "Guarda materiais no local correto ao final da atividade." },
        { code: "N05", description: "Segue a rotina visual do dia de forma independente, checando os passos." },
        { code: "N06", description: "Espera em fila com o grupo durante deslocamentos pela escola." },
        { code: "N07", description: "Levanta a mão e aguarda ser chamado para falar em sala." },
        { code: "N08", description: "Realiza tarefa de sala designada (ex.: distribuir materiais) sem lembrete." },
      ],
    },
    {
      domain: "O. Generalização de respostas",
      items: [
        { code: "O01", description: "Responde a instrução conhecida dada por pessoa diferente do terapeuta habitual." },
        { code: "O02", description: "Nomeia objeto conhecido em três exemplares diferentes (cor, tamanho, forma)." },
        { code: "O03", description: "Realiza habilidade aprendida em ambiente diferente daquele do treino." },
        { code: "O04", description: "Responde a instruções ditas com variações de palavras (ex.: \"senta\" e \"sente-se\")." },
        { code: "O05", description: "Usa habilidade aprendida em casa, conforme relato dos responsáveis." },
        { code: "O06", description: "Mantém habilidade aprendida um mês após o término do ensino direto." },
        { code: "O07", description: "Aplica habilidade aprendida a materiais novos sem ensino adicional." },
        { code: "O08", description: "Combina habilidades aprendidas separadamente em situação nova sem instrução." },
      ],
    },
    {
      domain: "P. Leitura",
      items: [
        { code: "P01", description: "Pareia letras idênticas entre um conjunto de cinco alternativas." },
        { code: "P02", description: "Identifica letras do próprio nome quando nomeadas pelo adulto." },
        { code: "P03", description: "Nomeia todas as letras do alfabeto apresentadas em ordem aleatória." },
        { code: "P04", description: "Associa som à letra para ao menos dez consoantes e vogais." },
        { code: "P05", description: "Lê palavras simples de duas sílabas formadas por sílabas diretas." },
        { code: "P06", description: "Lê ao menos vinte palavras de uso frequente de forma global." },
        { code: "P07", description: "Lê frase curta e realiza a ação descrita ou seleciona figura correspondente." },
        { code: "P08", description: "Lê parágrafo curto e responde perguntas sobre o conteúdo." },
      ],
    },
    {
      domain: "Q. Matemática",
      items: [
        { code: "Q01", description: "Conta de forma oral até dez em sequência correta." },
        { code: "Q02", description: "Conta objetos até cinco tocando um por vez e diz o total." },
        { code: "Q03", description: "Identifica numerais de 1 a 10 quando nomeados pelo adulto." },
        { code: "Q04", description: "Compara dois conjuntos e indica qual tem mais ou menos elementos." },
        { code: "Q05", description: "Forma conjunto com a quantidade solicitada de objetos até dez." },
        { code: "Q06", description: "Resolve adição simples com apoio de objetos, resultado até dez." },
        { code: "Q07", description: "Resolve subtração simples com apoio de objetos, resultado até dez." },
        { code: "Q08", description: "Resolve adição e subtração com resultado até vinte sem apoio de objetos." },
      ],
    },
    {
      domain: "R. Escrita",
      items: [
        { code: "R01", description: "Faz rabiscos em papel segurando o lápis com a mão." },
        { code: "R02", description: "Traça linhas retas e círculos sobre modelo pontilhado." },
        { code: "R03", description: "Copia formas simples (círculo, cruz, quadrado) a partir de modelo." },
        { code: "R04", description: "Traça letras sobre modelo pontilhado com formato reconhecível." },
        { code: "R05", description: "Copia letras do alfabeto a partir de modelo impresso." },
        { code: "R06", description: "Escreve o próprio nome sem modelo, com letras legíveis." },
        { code: "R07", description: "Escreve palavras ditadas de duas sílabas com grafia legível." },
        { code: "R08", description: "Escreve frase curta de forma independente com espaçamento adequado entre palavras." },
      ],
    },
    {
      domain: "S. Soletração",
      items: [
        { code: "S01", description: "Identifica a primeira letra de palavras familiares quando ditas." },
        { code: "S02", description: "Monta o próprio nome com letras móveis sem modelo." },
        { code: "S03", description: "Monta palavras de três letras com letras móveis após ditado." },
        { code: "S04", description: "Soletra oralmente palavras de três letras quando ditas pelo adulto." },
        { code: "S05", description: "Soletra por escrito palavras de duas sílabas formadas por sílabas diretas." },
        { code: "S06", description: "Soletra ao menos vinte palavras de uso frequente sem modelo." },
        { code: "S07", description: "Soletra palavras com dígrafos e encontros consonantais comuns." },
        { code: "S08", description: "Identifica e corrige erros de grafia em frases curtas escritas." },
      ],
    },
    {
      domain: "T. Vestir-se",
      items: [
        { code: "T01", description: "Tira meias e sapatos sem cadarço de forma independente." },
        { code: "T02", description: "Tira calça e camiseta com ajuda apenas para iniciar o movimento." },
        { code: "T03", description: "Veste camiseta orientando frente e costas de forma correta." },
        { code: "T04", description: "Veste calça e a puxa até a cintura sem ajuda física." },
        { code: "T05", description: "Calça sapatos no pé correto e fecha o velcro." },
        { code: "T06", description: "Abotoa e desabotoa botões grandes de casaco ou camisa." },
        { code: "T07", description: "Fecha zíper de casaco incluindo o encaixe inicial das duas partes." },
        { code: "T08", description: "Amarra cadarço com laço firme de forma independente." },
      ],
    },
    {
      domain: "U. Alimentação",
      items: [
        { code: "U01", description: "Come alimentos com as mãos levando-os à boca de forma independente." },
        { code: "U02", description: "Bebe de copo aberto sem derramar, de forma independente." },
        { code: "U03", description: "Usa colher para comer alimentos pastosos com pouco derramamento." },
        { code: "U04", description: "Usa garfo para espetar e levar alimentos sólidos à boca." },
        { code: "U05", description: "Come variedade de alimentos de diferentes texturas sem recusa." },
        { code: "U06", description: "Usa faca para passar manteiga ou cortar alimentos macios." },
        { code: "U07", description: "Serve-se de alimentos de uma travessa usando colher de servir." },
        { code: "U08", description: "Mantém boas maneiras durante refeição completa (usa guardanapo, mastiga de boca fechada)." },
      ],
    },
    {
      domain: "V. Higiene pessoal",
      items: [
        { code: "V01", description: "Permite que o adulto lave suas mãos e rosto sem resistência." },
        { code: "V02", description: "Lava as mãos com sabão e enxágua sem ajuda física." },
        { code: "V03", description: "Seca as mãos e o rosto com toalha após lavar." },
        { code: "V04", description: "Escova os dentes com pasta com supervisão apenas verbal." },
        { code: "V05", description: "Assoa o nariz com lenço quando solicitado e descarta o lenço." },
        { code: "V06", description: "Penteia ou escova o cabelo de forma independente." },
        { code: "V07", description: "Toma banho lavando todas as partes do corpo com lembrete verbal." },
        { code: "V08", description: "Realiza rotina completa de higiene matinal sem lembretes." },
      ],
    },
    {
      domain: "W. Uso do banheiro",
      items: [
        { code: "W01", description: "Senta no vaso sanitário por um minuto sem resistência." },
        { code: "W02", description: "Urina no vaso quando levado ao banheiro em horário programado." },
        { code: "W03", description: "Evacua no vaso quando levado ao banheiro em horário programado." },
        { code: "W04", description: "Indica necessidade de ir ao banheiro por gesto, figura ou palavra." },
        { code: "W05", description: "Vai ao banheiro de forma independente quando sente necessidade." },
        { code: "W06", description: "Abaixa e levanta as roupas antes e depois de usar o vaso." },
        { code: "W07", description: "Limpa-se com papel higiênico de forma adequada após evacuar." },
        { code: "W08", description: "Dá descarga, lava as mãos e sai do banheiro sem lembretes." },
      ],
    },
    {
      domain: "X. Motricidade grossa",
      items: [
        { code: "X01", description: "Anda de forma independente por dez metros sem apoio." },
        { code: "X02", description: "Sobe e desce escada alternando os pés com apoio no corrimão." },
        { code: "X03", description: "Chuta bola parada em direção a alvo a dois metros de distância." },
        { code: "X04", description: "Pula com os dois pés juntos tirando-os do chão ao mesmo tempo." },
        { code: "X05", description: "Arremessa bola com as mãos acima da cabeça em direção a alvo." },
        { code: "X06", description: "Pega bola grande lançada de dois metros usando as duas mãos." },
        { code: "X07", description: "Equilibra-se em um pé só por cinco segundos sem apoio." },
        { code: "X08", description: "Pedala triciclo ou bicicleta com rodinhas por dez metros." },
      ],
    },
    {
      domain: "Y. Motricidade fina",
      items: [
        { code: "Y01", description: "Pega objeto pequeno usando pinça de polegar e indicador." },
        { code: "Y02", description: "Empilha torre de seis blocos sem derrubar nenhum." },
        { code: "Y03", description: "Enfia contas grandes em cordão de forma independente." },
        { code: "Y04", description: "Rasga papel em pedaços pequenos usando as duas mãos." },
        { code: "Y05", description: "Corta papel com tesoura seguindo uma linha reta desenhada." },
        { code: "Y06", description: "Segura lápis com preensão de três dedos ao desenhar." },
        { code: "Y07", description: "Corta formas curvas com tesoura seguindo o contorno." },
        { code: "Y08", description: "Dobra papel ao meio alinhando as bordas e vinca a dobra." },
      ],
    },
  ],
};

export default abllsRTemplate;
