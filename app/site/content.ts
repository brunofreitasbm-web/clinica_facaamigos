/**
 * Todo o conteúdo editável da landing page pública (app/site).
 *
 * A página não escreve texto solto: quem for ajustar copy, telefone, horário
 * ou depoimento mexe SÓ neste arquivo, sem tocar em JSX. Cada bloco abaixo
 * corresponde a uma seção da página, na mesma ordem em que aparecem.
 *
 * O que é dado real (veio da tabela `clinics` e de `specialties`) está
 * marcado; o que ainda depende da clínica está sob CONTEUDO_PENDENTE.
 */

// ─────────────────────────────────────────────────────────────────────────
// Trava de publicação
// ─────────────────────────────────────────────────────────────────────────

/**
 * Enquanto `true`, a página mostra um aviso no topo tratando números e
 * depoimentos como exemplo. Vire para `false` só depois de substituir
 * NUMEROS e DEPOIMENTOS por dados reais — publicar "+500 famílias" sem ter
 * contado 500 famílias é propaganda enganosa, não copy.
 */
export const CONTEUDO_PENDENTE = true;

// ─────────────────────────────────────────────────────────────────────────
// Contato — dados reais (fonte: tabela `clinics`)
// ─────────────────────────────────────────────────────────────────────────

export const CONTATO = {
  whatsappE164: "5591991782027",
  whatsappVisivel: "(91) 99178-2027",
  telefoneVisivel: "(91) 99178-2027",
  email: "contato@clinicafacaamigos.com.br",
  endereco: {
    linha1: "Rua Boaventura da Silva, 1573",
    linha2: "Umarizal — Belém/PA",
    cep: "66060-060",
  },
  // TODO(clínica): confirmar o horário real de funcionamento.
  horario: [
    { dias: "Segunda a sexta", horas: "08h às 18h" },
    { dias: "Sábado", horas: "08h às 12h" },
  ],
  redes: [
    { nome: "Instagram", url: "https://www.instagram.com/facaamigos" },
    { nome: "Playground Inclusivo", url: "https://institutofacaamigos.com.br/" },
  ],
  /** Usado no <iframe> do mapa no rodapé. */
  mapaBusca: "Rua Boaventura da Silva, 1573, Umarizal, Belém, PA, 66060-060",
};

/**
 * Mensagem já digitada quando a família abre o WhatsApp — tira a fricção do
 * "e agora, o que eu escrevo?", que é onde muita conversa morre antes de
 * começar.
 */
export function linkWhatsApp(
  assunto = "Olá! Gostaria de agendar uma avaliação para meu filho(a).",
) {
  return `https://wa.me/${CONTATO.whatsappE164}?text=${encodeURIComponent(assunto)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Navegação e chamada principal
// ─────────────────────────────────────────────────────────────────────────

export const MENU = [
  { rotulo: "Início", href: "#inicio" },
  { rotulo: "Sobre", href: "#ecossistema" },
  { rotulo: "Serviços", href: "#servicos" },
  { rotulo: "Dúvidas", href: "#duvidas" },
  { rotulo: "Contato", href: "#agendar" },
];

export const CTA = {
  principal: "Agendar avaliação",
  principalApoio: "Resposta em até 2h úteis",
  secundario: "Falar no WhatsApp",
};

// ─────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────

export const HERO = {
  chapeu: "Belém · Umarizal",
  titulo: "Cada criança é um universo — e cada família merece um caminho.",
  subtitulo:
    "Centro de terapia comportamental para crianças autistas e em desenvolvimento, com equipe multidisciplinar, plano individual e prática baseada em evidências.",
  selos: [
    "Equipe multidisciplinar",
    "Abordagem ABA",
    "Ambiente inclusivo",
    "Acolhimento à família",
  ],
  imagem: {
    slot: "FOTO HERO — criança sorrindo em atendimento ou no playground inclusivo, luz natural e quente, sem cara de banco de imagem",
    alt: "Criança brincando com uma terapeuta em sala de atendimento do FaçaAmigos",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Prova social rápida — SUBSTITUIR por números reais
// ─────────────────────────────────────────────────────────────────────────

/**
 * Exemplos. Troque por números que a clínica consiga comprovar e então vire
 * CONTEUDO_PENDENTE para `false`. Lista vazia esconde a seção — publicar sem
 * números é melhor do que publicar números inventados.
 */
export const NUMEROS = [
  { valor: "7", rotulo: "especialidades na mesma equipe" },
  { valor: "—", rotulo: "famílias acompanhadas" },
  { valor: "—", rotulo: "avaliação média das famílias" },
  { valor: "1:1", rotulo: "terapeuta por criança na sessão" },
];

// ─────────────────────────────────────────────────────────────────────────
// Empatia
// ─────────────────────────────────────────────────────────────────────────

export const EMPATIA = {
  titulo: "A gente sabe o peso da espera.",
  paragrafos: [
    "A fila para uma avaliação é longa. As respostas vêm picadas, de um profissional de cada vez, e nenhuma delas conversa com a outra. No meio disso, você tenta entender o que seu filho precisa — e ainda segura a casa, o trabalho e a própria cabeça.",
    "Aqui, a primeira conversa não é um encaixe de agenda: é o começo de um plano. Seu filho é avaliado por uma equipe completa, não por um único profissional, e você sai sabendo qual é o próximo passo.",
  ],
  cta: "Conhecer nossa abordagem",
};

// ─────────────────────────────────────────────────────────────────────────
// Diferenciais
// ─────────────────────────────────────────────────────────────────────────

export const DIFERENCIAIS = [
  {
    icone: "equipe" as const,
    titulo: "Avaliação por equipe, não por um profissional",
    texto:
      "Psicologia, fono, terapia ocupacional e as demais áreas olham a mesma criança e fecham um plano único. Nada de laudos que se contradizem.",
  },
  {
    icone: "plano" as const,
    titulo: "Plano terapêutico individual",
    texto:
      "Objetivos escritos para o seu filho, com metas claras e revisão periódica. Você sabe o que está sendo trabalhado e por quê.",
  },
  {
    icone: "playground" as const,
    titulo: "Terapia que encontra a vida real",
    texto:
      "A integração com o Playground Inclusivo leva o que foi treinado na sessão para a brincadeira com outras crianças — que é onde a habilidade social de fato acontece.",
  },
  {
    icone: "relatorio" as const,
    titulo: "Relatórios de evolução transparentes",
    texto:
      "A família recebe o registro do que foi feito e do que mudou, sessão a sessão. Evolução aqui é dado, não impressão.",
  },
  {
    icone: "espaco" as const,
    titulo: "Espaço pensado para crianças neurodivergentes",
    texto:
      "Salas com controle de estímulo, materiais adaptados e rotina previsível, para a criança entrar sem sobrecarga sensorial.",
  },
  {
    icone: "familia" as const,
    titulo: "Cuidado também com pais e cuidadores",
    texto:
      "Orientação parental e canal aberto com a equipe. O que funciona na sessão precisa funcionar em casa — e isso se ensina.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Método
// ─────────────────────────────────────────────────────────────────────────

export const METODO = {
  titulo: "Como funciona, do primeiro contato à evolução",
  subtitulo:
    "Sem etapa surpresa e sem espera sem explicação. Estes são os quatro passos de toda família que chega aqui.",
  passos: [
    {
      titulo: "Avaliação inicial detalhada",
      texto:
        "Escuta da família, observação da criança e aplicação dos instrumentos indicados para a idade. É daqui que sai tudo o que vem depois.",
    },
    {
      titulo: "Plano terapêutico individual",
      texto:
        "A equipe se reúne, define objetivos e frequência e apresenta o plano para vocês em linguagem clara — com espaço para vocês discordarem.",
    },
    {
      titulo: "Sessões com a equipe especializada",
      texto:
        "Atendimento individualizado nas áreas indicadas, com registro de cada sessão e prática das habilidades no playground.",
    },
    {
      titulo: "Acompanhamento e revisão contínua",
      texto:
        "Metas revisadas periodicamente com a família. O plano muda quando a criança muda — não quando o calendário vira.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Serviços — fonte: tabela `specialties` da clínica
// ─────────────────────────────────────────────────────────────────────────

export const SERVICOS = [
  {
    titulo: "Psicologia ABA",
    texto:
      "Análise do comportamento aplicada ao desenvolvimento de linguagem, autonomia e convivência, com metas mensuráveis.",
  },
  {
    titulo: "Fonoaudiologia",
    texto:
      "Comunicação, fala, linguagem e alimentação — incluindo comunicação alternativa quando a fala ainda não é o caminho.",
  },
  {
    titulo: "Terapia Ocupacional",
    texto:
      "Integração sensorial, coordenação e autonomia nas atividades do dia a dia: vestir, comer, brincar, participar.",
  },
  {
    titulo: "Fisioterapia",
    texto:
      "Postura, força e coordenação motora global, com trabalho lúdico que a criança encara como brincadeira.",
  },
  {
    titulo: "Musicoterapia",
    texto:
      "A música como via de contato e regulação — especialmente potente para crianças que ainda não se comunicam por palavras.",
  },
  {
    titulo: "Psicopedagogia",
    texto:
      "Aprendizagem, atenção e organização escolar, com ponte direta entre a clínica e a escola da criança.",
  },
  {
    titulo: "Nutrição",
    texto:
      "Seletividade alimentar e rotina de refeições, tratadas junto com a terapia ocupacional e a fono, não isoladamente.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Ecossistema
// ─────────────────────────────────────────────────────────────────────────

export const ECOSSISTEMA = {
  chapeu: "Ecossistema FaçaAmigos",
  titulo: "Onde a terapia encontra a brincadeira de verdade",
  paragrafos: [
    "O Centro de Terapia Comportamental faz parte do FaçaAmigos Playground Inclusivo — um espaço onde crianças de todas as habilidades brincam juntas, no mesmo lugar, ao mesmo tempo.",
    "Na prática, isso muda o resultado: a habilidade treinada na sessão não fica presa na sala. Ela é usada com outras crianças, num ambiente supervisionado, que é onde a socialização deixa de ser exercício e vira vida.",
  ],
  cta: {
    rotulo: "Conhecer o Playground Inclusivo",
    href: "https://institutofacaamigos.com.br/",
  },
  imagem: {
    slot: "FOTO PLAYGROUND — crianças brincando juntas no playground inclusivo, plano aberto",
    alt: "Crianças brincando juntas no FaçaAmigos Playground Inclusivo",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Depoimentos — PLACEHOLDER, substituir por depoimentos reais autorizados
// ─────────────────────────────────────────────────────────────────────────

/**
 * Exemplos de escrita, não depoimentos reais. Substitua por textos que as
 * famílias tenham autorizado por escrito (é dado de saúde de criança:
 * autorização verbal não basta). Lista vazia esconde a seção.
 */
export const DEPOIMENTOS = [
  {
    texto:
      "Chegamos sem saber nem que perguntas fazer. Saímos da avaliação com um plano escrito e, pela primeira vez, com a sensação de que alguém tinha olhado o Theo inteiro.",
    autor: "[EXEMPLO] Mariana",
    contexto: "mãe do Theo, 4 anos",
  },
  {
    texto:
      "O que mudou pra gente foi o relatório. Toda semana eu sei o que foi trabalhado e o que ele conseguiu. Parou de ser fé, virou acompanhamento.",
    autor: "[EXEMPLO] Rafael",
    contexto: "pai da Alice, 6 anos",
  },
  {
    texto:
      "Ver meu filho brincando com outras crianças no playground, depois de tanto tempo sozinho, foi o dia em que eu entendi por que este lugar é diferente.",
    autor: "[EXEMPLO] Juliana",
    contexto: "mãe do Bento, 5 anos",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Equipe — PLACEHOLDER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lista vazia esconde a seção. Preencha com a equipe real e o registro
 * profissional de cada um (CRP/CRFa/CREFITO) — é o que sustenta a autoridade
 * da página; nome sem registro tem o efeito contrário.
 */
export const EQUIPE: Array<{
  nome: string;
  especialidade: string;
  registro: string;
  frase: string;
}> = [];

// ─────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────

export const FAQ = [
  {
    pergunta: "A partir de qual idade vocês atendem?",
    resposta:
      "Atendemos crianças a partir de 1 ano. Quanto mais cedo a intervenção começa, maior o ganho — mas nunca é tarde: se seu filho tem 8, 10 ou 12 anos, o plano é outro, e ele existe.",
  },
  {
    pergunta: "Preciso de laudo ou encaminhamento médico para marcar?",
    resposta:
      "Não. Você pode agendar a avaliação inicial mesmo sem diagnóstico fechado ou encaminhamento. Se já tiver laudos, relatórios da escola ou exames, traga — ajuda a equipe a chegar mais rápido no que importa.",
  },
  {
    pergunta: "Vocês atendem por convênio?",
    resposta:
      "Trabalhamos com atendimento particular e com convênios credenciados. Como a lista muda, confirme o seu plano com a recepção pelo WhatsApp antes de agendar — respondemos na hora se o seu está incluso.",
  },
  {
    pergunta: "Como funciona a primeira avaliação?",
    resposta:
      "É uma conversa com a família e uma observação da criança, conduzidas pela equipe multidisciplinar. Ao final, vocês recebem a devolutiva do que foi observado e a proposta de plano terapêutico, com objetivos, áreas indicadas e frequência.",
  },
  {
    pergunta: "As sessões são individuais ou em grupo?",
    resposta:
      "A base é individual, um terapeuta por criança. Atividades em grupo entram quando o plano indica trabalho de habilidades sociais, e acontecem no espaço do playground inclusivo, sempre supervisionadas.",
  },
  {
    pergunta: "Os pais podem participar ou assistir?",
    resposta:
      "Sim. A participação da família é parte do tratamento: há orientação parental e momentos de sessão acompanhada. O que funciona aqui precisa funcionar em casa, e isso se combina com vocês.",
  },
  {
    pergunta: "Qual a frequência recomendada?",
    resposta:
      "Depende do plano de cada criança — varia de uma a várias sessões por semana, por área. A avaliação inicial é justamente o que define isso; não existe pacote padrão.",
  },
  {
    pergunta: "O que diferencia o FaçaAmigos de outras clínicas?",
    resposta:
      "Três coisas: seu filho é avaliado por uma equipe inteira, e não por um profissional isolado; o plano e a evolução ficam registrados e são apresentados à família; e a terapia se estende ao Playground Inclusivo, onde a criança pratica com outras crianças o que aprendeu.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// CTA final e rodapé
// ─────────────────────────────────────────────────────────────────────────

export const FECHAMENTO = {
  titulo: "Dê o primeiro passo hoje.",
  subtitulo:
    "Preencha os dados e a recepção entra em contato para marcar a avaliação. Se preferir conversar antes, chame no WhatsApp — a gente responde.",
  reforco:
    "As turmas têm vaga limitada porque cada criança tem seu terapeuta na sessão. Quanto antes você falar com a gente, mais cedo entra na agenda.",
  garantia:
    "Seu filho será avaliado por uma equipe completa, não por um único profissional.",
};

export const RODAPE = {
  frase: "Feito com cuidado para todas as famílias.",
};
