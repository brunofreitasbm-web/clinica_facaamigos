/**
 * Template genérico de habilidades funcionais de vida (estrutura tipo AFLS).
 *
 * Estrutura (6 protocolos e suas subáreas) obtida de descrições públicas do
 * instrumento. O TEXTO DOS ITENS É ORIGINAL: nenhuma frase foi copiada ou
 * parafraseada do protocolo AFLS nem de traduções (autorizadas ou não). Cada
 * subárea traz 4 habilidades representativas em ordem crescente de
 * complexidade.
 *
 * `level` = protocolo; `domain` = subárea. Códigos: <PROTOCOLO>-<SUBÁREA>-<NN>.
 *
 * Fontes da estrutura:
 * - https://www.abaresourcecenter.com/post/what-is-the-afls
 * - https://difflearn.com/collections/ablls-r-and-afls
 */
import type { ProtocolTemplate } from "./types";

const BASICO = "Habilidades básicas de vida";
const DOMESTICO = "Habilidades domésticas";
const COMUNIDADE = "Participação na comunidade";
const ESCOLAR = "Habilidades escolares";
const VOCACIONAL = "Habilidades vocacionais";
const INDEPENDENTE = "Vida independente";

export const aflsTemplate: ProtocolTemplate = {
  name: "afls",
  displayName: "Habilidades funcionais de vida (estrutura tipo AFLS, genérico)",
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
    "https://www.abaresourcecenter.com/post/what-is-the-afls",
    "https://difflearn.com/collections/ablls-r-and-afls",
  ],
  notes:
    "O instrumento original tem centenas de itens distribuídos em 6 protocolos; este template traz 4 habilidades representativas por subárea, em ordem crescente de complexidade. Complete com itens próprios pelo importador em massa.",
  domains: [
    // ───────────── Habilidades básicas de vida ─────────────
    {
      level: BASICO,
      domain: "Autogerenciamento",
      items: [
        { code: "BAS-AUT-01", description: "Aguarda por um item desejado por trinta segundos sem apresentar comportamento problema." },
        { code: "BAS-AUT-02", description: "Segue programação visual de atividades diárias com lembrete verbal do adulto." },
        { code: "BAS-AUT-03", description: "Muda de atividade quando avisado, sem recusa ou protesto intenso." },
        { code: "BAS-AUT-04", description: "Escolhe entre duas opções de atividade e mantém a escolha até concluir." },
      ],
    },
    {
      level: BASICO,
      domain: "Comunicação básica",
      items: [
        { code: "BAS-COM-01", description: "Pede itens ou ajuda usando gesto, figura ou fala compreensível." },
        { code: "BAS-COM-02", description: "Responde \"sim\" ou \"não\" de forma confiável a perguntas sobre preferências." },
        { code: "BAS-COM-03", description: "Informa nome completo e nome de um responsável quando perguntado." },
        { code: "BAS-COM-04", description: "Comunica desconforto ou dor indicando o local do corpo afetado." },
      ],
    },
    {
      level: BASICO,
      domain: "Vestir-se",
      items: [
        { code: "BAS-VES-01", description: "Tira roupas simples (meias, camiseta, calça com elástico) sem ajuda física." },
        { code: "BAS-VES-02", description: "Veste camiseta, calça e meias orientando frente e costas corretamente." },
        { code: "BAS-VES-03", description: "Fecha botões, zíperes e velcros das próprias roupas de forma independente." },
        { code: "BAS-VES-04", description: "Escolhe roupa adequada ao clima e à ocasião do dia sem orientação." },
      ],
    },
    {
      level: BASICO,
      domain: "Uso do banheiro",
      items: [
        { code: "BAS-BAN-01", description: "Indica necessidade de usar o banheiro antes de ocorrer um acidente." },
        { code: "BAS-BAN-02", description: "Usa o vaso sanitário de forma independente, incluindo abaixar e levantar as roupas." },
        { code: "BAS-BAN-03", description: "Limpa-se com papel higiênico, dá descarga e lava as mãos sem lembretes." },
        { code: "BAS-BAN-04", description: "Usa banheiros fora de casa (escola, shopping) de forma independente." },
      ],
    },
    {
      level: BASICO,
      domain: "Higiene",
      items: [
        { code: "BAS-HIG-01", description: "Lava as mãos com sabão e enxágua sem ajuda física." },
        { code: "BAS-HIG-02", description: "Escova os dentes por dois minutos cobrindo todas as superfícies." },
        { code: "BAS-HIG-03", description: "Assoa o nariz, cobre a boca ao tossir e descarta lenços usados." },
        { code: "BAS-HIG-04", description: "Cuida de unhas, cabelo e desodorante em rotina semanal sem lembretes." },
      ],
    },
    {
      level: BASICO,
      domain: "Banho",
      items: [
        { code: "BAS-BNH-01", description: "Entra e sai do chuveiro ou banheira com segurança, sem ajuda física." },
        { code: "BAS-BNH-02", description: "Ensaboa e enxágua o corpo inteiro com lembrete verbal para partes esquecidas." },
        { code: "BAS-BNH-03", description: "Lava e enxágua o cabelo com xampu sem deixar resíduos." },
        { code: "BAS-BNH-04", description: "Regula a temperatura da água, toma banho completo e se seca sem supervisão." },
      ],
    },
    {
      level: BASICO,
      domain: "Saúde/segurança/primeiros socorros",
      items: [
        { code: "BAS-SAU-01", description: "Afasta-se de objetos perigosos (fogão, tomada) quando alertado por um adulto." },
        { code: "BAS-SAU-02", description: "Informa a um adulto quando se machuca ou quando vê alguém ferido." },
        { code: "BAS-SAU-03", description: "Lava um pequeno corte e aplica curativo adesivo de forma independente." },
        { code: "BAS-SAU-04", description: "Toma medicação de rotina no horário certo com supervisão apenas verbal." },
      ],
    },
    {
      level: BASICO,
      domain: "Rotinas noturnas",
      items: [
        { code: "BAS-NOI-01", description: "Coloca o pijama e escova os dentes quando avisado que é hora de dormir." },
        { code: "BAS-NOI-02", description: "Realiza a sequência completa da rotina noturna com apoio de cronograma visual." },
        { code: "BAS-NOI-03", description: "Vai para a cama no horário combinado sem protestar e permanece deitado." },
        { code: "BAS-NOI-04", description: "Prepara materiais do dia seguinte (mochila, roupa) antes de dormir sem lembrete." },
      ],
    },

    // ───────────── Habilidades domésticas ─────────────
    {
      level: DOMESTICO,
      domain: "Refeições em casa",
      items: [
        { code: "DOM-REF-01", description: "Senta-se à mesa e permanece sentado até terminar a refeição." },
        { code: "DOM-REF-02", description: "Serve-se de porções adequadas usando talheres de servir." },
        { code: "DOM-REF-03", description: "Põe a mesa com pratos, copos e talheres para toda a família." },
        { code: "DOM-REF-04", description: "Retira a mesa e guarda sobras em recipientes fechados na geladeira." },
      ],
    },
    {
      level: DOMESTICO,
      domain: "Louça",
      items: [
        { code: "DOM-LOU-01", description: "Leva o próprio prato e copo até a pia após a refeição." },
        { code: "DOM-LOU-02", description: "Enxágua a louça e a coloca no escorredor ou na lava-louças." },
        { code: "DOM-LOU-03", description: "Lava louça com esponja e detergente removendo todos os resíduos." },
        { code: "DOM-LOU-04", description: "Seca e guarda a louça nos armários corretos sem orientação." },
      ],
    },
    {
      level: DOMESTICO,
      domain: "Roupas e lavanderia",
      items: [
        { code: "DOM-ROU-01", description: "Coloca roupas usadas no cesto de roupa suja ao trocar-se." },
        { code: "DOM-ROU-02", description: "Separa roupas claras e escuras antes de lavar." },
        { code: "DOM-ROU-03", description: "Opera a máquina de lavar escolhendo o ciclo e adicionando sabão." },
        { code: "DOM-ROU-04", description: "Estende, dobra e guarda as roupas limpas nos lugares corretos." },
      ],
    },
    {
      level: DOMESTICO,
      domain: "Limpeza e tarefas",
      items: [
        { code: "DOM-LIM-01", description: "Guarda brinquedos e objetos pessoais nos locais combinados quando solicitado." },
        { code: "DOM-LIM-02", description: "Varre o chão de um cômodo recolhendo a sujeira na pá." },
        { code: "DOM-LIM-03", description: "Limpa superfícies com pano e produto adequado ao material." },
        { code: "DOM-LIM-04", description: "Executa lista semanal de tarefas domésticas sem lembretes." },
      ],
    },
    {
      level: DOMESTICO,
      domain: "Mecânica doméstica",
      items: [
        { code: "DOM-MEC-01", description: "Liga e desliga luzes e aparelhos simples com segurança." },
        { code: "DOM-MEC-02", description: "Troca o saco de lixo e leva o lixo até o local de coleta." },
        { code: "DOM-MEC-03", description: "Troca uma lâmpada ou as pilhas de um controle remoto com segurança." },
        { code: "DOM-MEC-04", description: "Identifica problema doméstico (ex.: vazamento) e comunica ao responsável." },
      ],
    },
    {
      level: DOMESTICO,
      domain: "Lazer",
      items: [
        { code: "DOM-LAZ-01", description: "Escolhe atividade de lazer entre opções oferecidas e a mantém por quinze minutos." },
        { code: "DOM-LAZ-02", description: "Usa aparelhos de entretenimento (TV, tablet) respeitando o tempo combinado." },
        { code: "DOM-LAZ-03", description: "Organiza atividade de lazer sozinho durante o tempo livre sem ser instruído." },
        { code: "DOM-LAZ-04", description: "Convida familiar ou amigo para jogo ou atividade compartilhada." },
      ],
    },
    {
      level: DOMESTICO,
      domain: "Cozinha",
      items: [
        { code: "DOM-COZ-01", description: "Pega alimentos e bebidas na geladeira e os guarda de volta." },
        { code: "DOM-COZ-02", description: "Usa micro-ondas para aquecer alimento programando o tempo." },
        { code: "DOM-COZ-03", description: "Usa facas e utensílios cortantes com técnica segura." },
        { code: "DOM-COZ-04", description: "Mantém a cozinha limpa e organizada após o uso." },
      ],
    },
    {
      level: DOMESTICO,
      domain: "Cozinhar",
      items: [
        { code: "DOM-CZR-01", description: "Prepara lanche frio simples (sanduíche, cereal com leite) sozinho." },
        { code: "DOM-CZR-02", description: "Prepara alimento no fogão sob supervisão (ex.: ovo mexido)." },
        { code: "DOM-CZR-03", description: "Segue receita simples de três a cinco passos de forma independente." },
        { code: "DOM-CZR-04", description: "Planeja e prepara refeição completa para si e para outra pessoa." },
      ],
    },

    // ───────────── Participação na comunidade ─────────────
    {
      level: COMUNIDADE,
      domain: "Mobilidade básica",
      items: [
        { code: "COM-MOB-01", description: "Anda ao lado do adulto em locais públicos sem correr ou se afastar." },
        { code: "COM-MOB-02", description: "Para na calçada e olha para os dois lados antes de atravessar." },
        { code: "COM-MOB-03", description: "Atravessa ruas na faixa de pedestres respeitando o semáforo." },
        { code: "COM-MOB-04", description: "Desloca-se de forma independente por rotas familiares no bairro." },
      ],
    },
    {
      level: COMUNIDADE,
      domain: "Conhecimento da comunidade",
      items: [
        { code: "COM-CON-01", description: "Identifica locais comuns (mercado, farmácia, escola) por figuras ou fachadas." },
        { code: "COM-CON-02", description: "Reconhece sinais e placas de segurança (pare, saída, banheiro)." },
        { code: "COM-CON-03", description: "Sabe o próprio endereço e o telefone de um responsável." },
        { code: "COM-CON-04", description: "Localiza serviços necessários (posto de saúde, correio) no bairro." },
      ],
    },
    {
      level: COMUNIDADE,
      domain: "Compras",
      items: [
        { code: "COM-CMP-01", description: "Acompanha o adulto no mercado e coloca itens indicados no carrinho." },
        { code: "COM-CMP-02", description: "Encontra nas prateleiras itens de uma lista com figuras ou palavras." },
        { code: "COM-CMP-03", description: "Aguarda na fila do caixa e entrega o pagamento ao atendente." },
        { code: "COM-CMP-04", description: "Faz compra completa com lista, pagamento e conferência do troco." },
      ],
    },
    {
      level: COMUNIDADE,
      domain: "Refeições em público",
      items: [
        { code: "COM-RPU-01", description: "Permanece sentado à mesa de restaurante durante toda a refeição." },
        { code: "COM-RPU-02", description: "Escolhe item de cardápio com figuras e comunica o pedido." },
        { code: "COM-RPU-03", description: "Faz o pedido ao atendente usando frases completas e educadas." },
        { code: "COM-RPU-04", description: "Pede a conta, confere os valores e paga de forma independente." },
      ],
    },
    {
      level: COMUNIDADE,
      domain: "Dinheiro",
      items: [
        { code: "COM-DIN-01", description: "Identifica moedas e cédulas de uso comum pelo valor." },
        { code: "COM-DIN-02", description: "Soma valores de moedas e cédulas até cinquenta reais." },
        { code: "COM-DIN-03", description: "Verifica se tem dinheiro suficiente para um item antes de comprar." },
        { code: "COM-DIN-04", description: "Usa cartão de débito ou pagamento digital com senha em segurança." },
      ],
    },
    {
      level: COMUNIDADE,
      domain: "Telefone",
      items: [
        { code: "COM-TEL-01", description: "Atende chamada, diz \"alô\" e se identifica." },
        { code: "COM-TEL-02", description: "Liga para número de familiar salvo nos contatos." },
        { code: "COM-TEL-03", description: "Envia mensagem de texto compreensível para pedir ou informar algo." },
        { code: "COM-TEL-04", description: "Liga para serviço de emergência e informa nome, local e situação." },
      ],
    },
    {
      level: COMUNIDADE,
      domain: "Tempo",
      items: [
        { code: "COM-TMP-01", description: "Identifica momentos do dia (manhã, tarde, noite) associados às rotinas." },
        { code: "COM-TMP-02", description: "Lê horas inteiras e meias horas em relógio digital." },
        { code: "COM-TMP-03", description: "Usa calendário para localizar dias da semana e datas de eventos." },
        { code: "COM-TMP-04", description: "Estima o tempo necessário para chegar a compromissos e sai no horário." },
      ],
    },
    {
      level: COMUNIDADE,
      domain: "Consciência social e boas maneiras",
      items: [
        { code: "COM-SOC-01", description: "Cumprimenta e se despede de pessoas em ambientes públicos." },
        { code: "COM-SOC-02", description: "Usa \"por favor\", \"obrigado\" e \"com licença\" em situações apropriadas." },
        { code: "COM-SOC-03", description: "Respeita a distância pessoal e a ordem da fila em locais públicos." },
        { code: "COM-SOC-04", description: "Ajusta tom de voz e comportamento ao contexto (biblioteca, igreja, festa)." },
      ],
    },

    // ───────────── Habilidades escolares ─────────────
    {
      level: ESCOLAR,
      domain: "Mecânica de sala de aula",
      items: [
        { code: "ESC-MSA-01", description: "Senta na própria carteira e guarda materiais quando solicitado." },
        { code: "ESC-MSA-02", description: "Levanta a mão e aguarda a vez para falar durante a aula." },
        { code: "ESC-MSA-03", description: "Copia tarefas do quadro e as anota na agenda." },
        { code: "ESC-MSA-04", description: "Organiza materiais e entrega tarefas nos prazos sem lembretes." },
      ],
    },
    {
      level: ESCOLAR,
      domain: "Refeições na escola",
      items: [
        { code: "ESC-RES-01", description: "Pega e carrega a própria bandeja ou lancheira sem derrubar." },
        { code: "ESC-RES-02", description: "Aguarda na fila do refeitório e escolhe os alimentos." },
        { code: "ESC-RES-03", description: "Come em tempo adequado e descarta resíduos no lixo correto." },
        { code: "ESC-RES-04", description: "Conversa com colegas durante a refeição mantendo boas maneiras." },
      ],
    },
    {
      level: ESCOLAR,
      domain: "Habilidades sociais",
      items: [
        { code: "ESC-SOE-01", description: "Responde a colegas que o cumprimentam ou lhe perguntam algo." },
        { code: "ESC-SOE-02", description: "Participa de brincadeira em grupo respeitando regras e turnos." },
        { code: "ESC-SOE-03", description: "Pede ajuda a um professor quando há conflito com colega." },
        { code: "ESC-SOE-04", description: "Mantém amizade com colega, procurando-o em intervalos e atividades." },
      ],
    },
    {
      level: ESCOLAR,
      domain: "Tecnologia",
      items: [
        { code: "ESC-TEC-01", description: "Liga o computador ou tablet e abre o aplicativo indicado." },
        { code: "ESC-TEC-02", description: "Digita nome de usuário e senha para acessar a conta escolar." },
        { code: "ESC-TEC-03", description: "Usa pesquisa na internet para encontrar informação para uma tarefa." },
        { code: "ESC-TEC-04", description: "Cria e envia documento digital ou e-mail com anexo." },
      ],
    },
    {
      level: ESCOLAR,
      domain: "Conhecimentos gerais",
      items: [
        { code: "ESC-CGE-01", description: "Informa nome, idade, cidade e nome da escola quando perguntado." },
        { code: "ESC-CGE-02", description: "Nomeia os dias da semana e os meses do ano em ordem." },
        { code: "ESC-CGE-03", description: "Identifica profissões comuns e descreve o que cada uma faz." },
        { code: "ESC-CGE-04", description: "Explica regras básicas de segurança e cidadania (ex.: por que reciclar)." },
      ],
    },
    {
      level: ESCOLAR,
      domain: "Acadêmicos básicos",
      items: [
        { code: "ESC-ACB-01", description: "Lê palavras simples e escreve o próprio nome completo." },
        { code: "ESC-ACB-02", description: "Conta e escreve numerais até cem em ordem." },
        { code: "ESC-ACB-03", description: "Lê parágrafo curto e responde perguntas sobre o conteúdo." },
        { code: "ESC-ACB-04", description: "Resolve adições e subtrações com números de dois dígitos." },
      ],
    },
    {
      level: ESCOLAR,
      domain: "Acadêmicos aplicados",
      items: [
        { code: "ESC-ACA-01", description: "Lê rótulos de produtos e placas de uso diário." },
        { code: "ESC-ACA-02", description: "Usa medidas (xícara, colher) para seguir uma receita." },
        { code: "ESC-ACA-03", description: "Preenche formulário simples com dados pessoais de forma legível." },
        { code: "ESC-ACA-04", description: "Calcula troco e compara preços em situação real de compra." },
      ],
    },

    // ───────────── Habilidades vocacionais ─────────────
    {
      level: VOCACIONAL,
      domain: "Preparação para o trabalho",
      items: [
        { code: "VOC-PRE-01", description: "Identifica interesses e tarefas que gosta de realizar." },
        { code: "VOC-PRE-02", description: "Chega no horário com uniforme ou roupa adequada e higiene em dia." },
        { code: "VOC-PRE-03", description: "Preenche ficha de dados pessoais para candidatura a vaga." },
        { code: "VOC-PRE-04", description: "Participa de entrevista simulada respondendo perguntas básicas sobre si." },
      ],
    },
    {
      level: VOCACIONAL,
      domain: "Rotina de trabalho",
      items: [
        { code: "VOC-RTR-01", description: "Registra a chegada e a saída conforme a rotina do local." },
        { code: "VOC-RTR-02", description: "Inicia as tarefas designadas sem lembrete do supervisor." },
        { code: "VOC-RTR-03", description: "Faz pausas nos horários combinados e retorna ao trabalho." },
        { code: "VOC-RTR-04", description: "Conclui a lista de tarefas do dia checando cada item." },
      ],
    },
    {
      level: VOCACIONAL,
      domain: "Interação no trabalho",
      items: [
        { code: "VOC-INT-01", description: "Cumprimenta colegas e supervisores ao chegar ao trabalho." },
        { code: "VOC-INT-02", description: "Pede ajuda ou esclarecimento ao supervisor quando tem dúvida." },
        { code: "VOC-INT-03", description: "Aceita feedback e corrige a tarefa sem irritação." },
        { code: "VOC-INT-04", description: "Colabora com colegas em tarefas compartilhadas dividindo responsabilidades." },
      ],
    },
    {
      level: VOCACIONAL,
      domain: "Segurança no trabalho",
      items: [
        { code: "VOC-SEG-01", description: "Usa equipamentos de proteção (luvas, óculos) quando indicado." },
        { code: "VOC-SEG-02", description: "Identifica sinais de perigo e áreas restritas no local de trabalho." },
        { code: "VOC-SEG-03", description: "Relata acidentes ou situações inseguras ao supervisor imediatamente." },
        { code: "VOC-SEG-04", description: "Segue procedimento de evacuação em simulado de emergência." },
      ],
    },
    {
      level: VOCACIONAL,
      domain: "Tarefas ocupacionais",
      items: [
        { code: "VOC-TAR-01", description: "Realiza tarefa repetitiva simples (ex.: montar kits) por quinze minutos." },
        { code: "VOC-TAR-02", description: "Organiza itens por tipo, tamanho ou etiqueta em prateleiras." },
        { code: "VOC-TAR-03", description: "Opera equipamento simples (ex.: etiquetadora, copiadora) com precisão." },
        { code: "VOC-TAR-04", description: "Mantém ritmo e qualidade em tarefa de uma hora com supervisão mínima." },
      ],
    },

    // ───────────── Vida independente ─────────────
    {
      level: INDEPENDENTE,
      domain: "Organização",
      items: [
        { code: "IND-ORG-01", description: "Mantém quarto e espaço pessoal organizados ao longo da semana." },
        { code: "IND-ORG-02", description: "Usa agenda ou aplicativo para registrar compromissos e tarefas." },
        { code: "IND-ORG-03", description: "Guarda documentos importantes em local definido e os encontra quando precisa." },
        { code: "IND-ORG-04", description: "Planeja a semana priorizando tarefas e compromissos por ordem de importância." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Autocuidado",
      items: [
        { code: "IND-ACU-01", description: "Realiza higiene diária completa sem lembretes de outra pessoa." },
        { code: "IND-ACU-02", description: "Escolhe e prepara roupas limpas para a semana." },
        { code: "IND-ACU-03", description: "Marca e comparece a consultas médicas e odontológicas de rotina." },
        { code: "IND-ACU-04", description: "Reconhece sinais de doença e procura atendimento adequado." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Manutenção e limpeza",
      items: [
        { code: "IND-MAN-01", description: "Limpa banheiro e cozinha semanalmente com produtos adequados." },
        { code: "IND-MAN-02", description: "Troca roupa de cama e lava toalhas regularmente." },
        { code: "IND-MAN-03", description: "Aspira ou varre e passa pano em toda a casa." },
        { code: "IND-MAN-04", description: "Mantém estoque de produtos de limpeza e repõe quando acabam." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Reparos",
      items: [
        { code: "IND-REP-01", description: "Troca lâmpadas e pilhas de aparelhos de forma segura." },
        { code: "IND-REP-02", description: "Desentope ralo ou vaso sanitário usando desentupidor sem ajuda." },
        { code: "IND-REP-03", description: "Aperta parafusos e conserta pequenos danos com ferramentas básicas." },
        { code: "IND-REP-04", description: "Identifica quando chamar um profissional e faz o contato." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Deslocamento na comunidade",
      items: [
        { code: "IND-DES-01", description: "Caminha sozinho por rotas familiares até destinos próximos." },
        { code: "IND-DES-02", description: "Usa mapa ou aplicativo de navegação para chegar a local novo." },
        { code: "IND-DES-03", description: "Pede informação a pessoa adequada quando se perde." },
        { code: "IND-DES-04", description: "Planeja rota e horário para chegar a compromisso em local desconhecido." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Transporte",
      items: [
        { code: "IND-TRA-01", description: "Identifica o ponto de ônibus e a linha correta para o destino." },
        { code: "IND-TRA-02", description: "Paga a passagem e sinaliza a parada no destino." },
        { code: "IND-TRA-03", description: "Usa aplicativo de transporte solicitando corrida e conferindo o veículo." },
        { code: "IND-TRA-04", description: "Combina diferentes meios de transporte para uma viagem mais longa." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Utensílios de cozinha",
      items: [
        { code: "IND-UTE-01", description: "Usa liquidificador e batedeira com segurança, montando e desmontando as peças." },
        { code: "IND-UTE-02", description: "Usa o forno regulando temperatura e tempo conforme o preparo." },
        { code: "IND-UTE-03", description: "Usa facas apropriadas para cada tipo de corte." },
        { code: "IND-UTE-04", description: "Limpa e guarda utensílios e eletrodomésticos após o uso." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Planejamento de refeições",
      items: [
        { code: "IND-PLA-01", description: "Escolhe alimentos de diferentes grupos para uma refeição equilibrada." },
        { code: "IND-PLA-02", description: "Planeja cardápio para três dias com refeições variadas." },
        { code: "IND-PLA-03", description: "Elabora lista de compras a partir do cardápio planejado." },
        { code: "IND-PLA-04", description: "Planeja cardápio semanal considerando orçamento e aproveitamento de sobras." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Gestão do dinheiro",
      items: [
        { code: "IND-GDI-01", description: "Guarda dinheiro em local seguro e sabe quanto possui." },
        { code: "IND-GDI-02", description: "Registra os gastos diários em caderno ou aplicativo de forma consistente." },
        { code: "IND-GDI-03", description: "Elabora orçamento mensal simples com receitas e despesas." },
        { code: "IND-GDI-04", description: "Paga contas em dia e verifica o extrato bancário." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Compras independentes",
      items: [
        { code: "IND-CIN-01", description: "Faz compras de mercado completas com lista e orçamento." },
        { code: "IND-CIN-02", description: "Compara preços e marcas escolhendo o melhor custo-benefício." },
        { code: "IND-CIN-03", description: "Compra roupas verificando o tamanho e experimentando antes de pagar." },
        { code: "IND-CIN-04", description: "Realiza compras online com segurança conferindo dados e prazo de entrega." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Gestão pessoal",
      items: [
        { code: "IND-GPE-01", description: "Guarda e apresenta documentos pessoais quando solicitado em serviços ou atendimentos." },
        { code: "IND-GPE-02", description: "Toma medicações prescritas nos horários corretos sem supervisão." },
        { code: "IND-GPE-03", description: "Renova documentos e cadastros quando vencem, sem lembrete de outra pessoa." },
        { code: "IND-GPE-04", description: "Toma decisões sobre a própria rotina ponderando as consequências." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Segurança",
      items: [
        { code: "IND-SGU-01", description: "Tranca portas e janelas ao sair de casa e ao dormir." },
        { code: "IND-SGU-02", description: "Não abre a porta para desconhecidos e verifica identidade de prestadores." },
        { code: "IND-SGU-03", description: "Reconhece golpes por telefone ou internet e não fornece dados pessoais." },
        { code: "IND-SGU-04", description: "Age corretamente em emergências domésticas (incêndio, vazamento de gás)." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Resolução de problemas",
      items: [
        { code: "IND-PRO-01", description: "Identifica que há um problema e o descreve com clareza." },
        { code: "IND-PRO-02", description: "Propõe ao menos duas soluções para um problema cotidiano." },
        { code: "IND-PRO-03", description: "Escolhe e aplica uma solução, avaliando o resultado." },
        { code: "IND-PRO-04", description: "Pede ajuda a pessoa adequada quando a solução escolhida falha." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Interações sociais",
      items: [
        { code: "IND-ISO-01", description: "Inicia e mantém conversa com pessoas conhecidas por vários turnos." },
        { code: "IND-ISO-02", description: "Mantém contato com amigos por mensagens ou visitas." },
        { code: "IND-ISO-03", description: "Participa de atividades comunitárias (grupos, cursos, igreja) de forma regular." },
        { code: "IND-ISO-04", description: "Estabelece e mantém relacionamentos respeitando limites próprios e alheios." },
      ],
    },
    {
      level: INDEPENDENTE,
      domain: "Convivência com outros",
      items: [
        { code: "IND-CVO-01", description: "Respeita espaço e pertences das pessoas que moram na mesma casa." },
        { code: "IND-CVO-02", description: "Divide tarefas domésticas com quem mora junto e cumpre a sua parte." },
        { code: "IND-CVO-03", description: "Negocia regras de convivência (horários, visitas, barulho) com quem mora junto." },
        { code: "IND-CVO-04", description: "Resolve conflitos com colegas de moradia por meio de conversa." },
      ],
    },
  ],
};

export default aflsTemplate;
