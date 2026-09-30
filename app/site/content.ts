/**
 * Todo o conteúdo editável da landing page pública (app/site).
 *
 * A página não escreve texto solto: quem for ajustar copy, telefone, horário
 * ou depoimento mexe SÓ neste arquivo, sem tocar em JSX. Cada bloco abaixo
 * corresponde a uma seção da página, na mesma ordem em que aparecem.
 *
 * Fonte do texto: o hub institucional (institutofacaamigos.com.br, páginas
 * /servicos e bloco #clinica), para a clínica falar a mesma coisa nos dois
 * lugares. Estrutura da página: PROMESSA (hero + empatia), CONFIANÇA
 * (responsável técnica, convênios, como funciona, FAQ) e OFERTA (lista de
 * espera, mapeamento gratuito, convênios/particular).
 *
 * Regra editorial herdada do hub: vender alívio e clareza, nunca cura nem
 * prazo de resultado.
 */

// ─────────────────────────────────────────────────────────────────────────
// Contato — dados reais (fonte: tabela `clinics`)
// ─────────────────────────────────────────────────────────────────────────

export const CONTATO = {
  whatsappE164: "5591991782027",
  whatsappVisivel: "(91) 99178-2027",
  telefoneVisivel: "(91) 99178-2027",
  email: "institutofacaamigos@gmail.com",
  endereco: {
    linha1: "Rua Boaventura da Silva, 1573",
    linha2: "Umarizal — Belém/PA",
    cep: "66060-060",
  },
  // Horário de funcionamento da clínica após a inauguração.
  horario: [
    { dias: "Segunda a sexta", horas: "08h às 18h" },
    { dias: "Sábado", horas: "08h às 12h" },
  ],
  redes: [
    { nome: "Instagram", url: "https://www.instagram.com/facaamigos.belem" },
    { nome: "Playground Inclusivo", url: "https://institutofacaamigos.com.br/" },
  ],
  /** Usado no <iframe> do mapa no rodapé. */
  mapaBusca: "Rua Boaventura da Silva, 1573, Umarizal, Belém, PA, 66060-060",
};

/** Razão social e CNPJ que assinam a clínica (mesmos do rodapé do hub). */
export const EMPRESA = {
  razaoSocial: "Instituto Faça Amigos Ltda",
  cnpj: "22.161.197/0001-83",
};

/** Links do ecossistema (hub). */
export const HUB = {
  mapeamento:
    "https://institutofacaamigos.com.br/teste?utm_source=clinica&utm_medium=site&utm_campaign=mapeamento",
  guias:
    "https://institutofacaamigos.com.br/aprender?utm_source=clinica&utm_medium=site&utm_campaign=guias",
  playground: "https://institutofacaamigos.com.br/playground",
};

/** Mensagem já digitada quando a família abre o WhatsApp. */
export const MENSAGEM_LISTA_ESPERA =
  "Olá! Quero entrar na lista de espera da Clínica FaçaAmigos - Centro de Terapia Comportamental (vim pelo site).";

export function linkWhatsApp(assunto = MENSAGEM_LISTA_ESPERA) {
  return `https://wa.me/${CONTATO.whatsappE164}?text=${encodeURIComponent(assunto)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Navegação e chamada principal
// ─────────────────────────────────────────────────────────────────────────

export const MENU = [
  { rotulo: "Início", href: "#inicio" },
  { rotulo: "Serviços", href: "#servicos" },
  { rotulo: "Quem cuida", href: "#quem-cuida" },
  { rotulo: "Convênios", href: "#planos" },
  { rotulo: "Dúvidas", href: "#duvidas" },
  { rotulo: "Contato", href: "#agendar" },
];

/**
 * A porta de entrada é a lista de espera pelo WhatsApp (gratuita): a clínica
 * ainda não abriu, então "agendar" seria prometer o que não existe. O
 * secundário leva à pergunta que mais chega — se o convênio é atendido.
 */
export const CTA = {
  principal: "Entrar na lista de espera",
  principalApoio: "Sem custo · você é avisada assim que abrirmos",
  secundario: "Ver convênios",
};

// ─────────────────────────────────────────────────────────────────────────
// Hero — PROMESSA
// ─────────────────────────────────────────────────────────────────────────

export const HERO = {
  chapeu: "Umarizal · Belém · Inauguração em breve",
  titulo: "Se você sente que algo está diferente, aqui você vai ser ouvida.",
  subtitulo:
    "Equipe multidisciplinar, terapia comportamental e um plano que faz sentido para a sua família, com ciência, acolhimento e afeto. Com ou sem laudo.",
  selos: [
    "Convênios IASEP e PROASA",
    "Equipe multidisciplinar",
    "Psicóloga responsável · CRP 10/4727",
    "Com ou sem laudo",
  ],
  imagem: {
    src: "/site/atendimento.webp",
    largura: 1500,
    altura: 2000,
    alt: "Terapeuta e criança desenhando juntos numa mesa, ao lado da piscina de bolinhas do FaçaAmigos",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Fatos rápidos — só o que é verificável (nada de contagem de famílias)
// ─────────────────────────────────────────────────────────────────────────

export const NUMEROS = [
  { valor: "2", rotulo: "convênios: IASEP e PROASA" },
  { valor: "7", rotulo: "áreas de cuidado na mesma equipe" },
  { valor: "R$ 0", rotulo: "para entrar na lista de espera" },
  { valor: "5 min", rotulo: "mapeamento comportamental gratuito" },
];

// ─────────────────────────────────────────────────────────────────────────
// Empatia
// ─────────────────────────────────────────────────────────────────────────

export const EMPATIA = {
  titulo: "Ninguém deveria passar por isso sem ser ouvida.",
  paragrafos: [
    "Você percebe que algo está diferente e ninguém explica direito. As respostas vêm picadas, um profissional de cada vez, e nenhuma conversa com a outra. No meio disso, você ainda segura a casa, o trabalho e a própria cabeça.",
    "Aqui, a primeira conversa não é um encaixe de agenda: é a hora de você ser ouvida. Sem rótulo e sem pressa. A gente entende a rotina da sua família, não só um sintoma, e monta com você um caminho possível.",
  ],
  sinaisTitulo: "Sinais que valem uma conversa",
  sinais: [
    "Birras que não passam, ou que pioram com o tempo.",
    "Seu filho não olha nos olhos ou não responde quando é chamado.",
    "A escola já te chamou mais de uma vez pela mesma queixa.",
    "A fala demora a aparecer, ou é difícil de entender.",
    "Sons, luzes ou texturas comuns incomodam demais o seu filho.",
  ],
  sinaisNota: "Nenhum desses é um rótulo. É um motivo para conversar.",
  cta: "Conhecer o que a clínica oferece",
};

// ─────────────────────────────────────────────────────────────────────────
// Diferenciais — CONFIANÇA
// ─────────────────────────────────────────────────────────────────────────

export const DIFERENCIAIS = [
  {
    icone: "familia" as const,
    titulo: "Você é ouvida antes de qualquer coisa",
    texto:
      "A conversa de acolhimento vem primeiro. A gente escuta a rotina da sua família antes de falar em diagnóstico, terapia ou frequência.",
  },
  {
    icone: "equipe" as const,
    titulo: "Uma equipe, um plano só",
    texto:
      "Psicologia, fonoaudiologia, terapia ocupacional e psicopedagogia olham a mesma criança e conversam entre si, em vez de entregar respostas soltas.",
  },
  {
    icone: "plano" as const,
    titulo: "Um plano que cabe na sua rotina",
    texto:
      "Sem prazo fechado e sem promessa de resultado: um caminho possível, ajustado com você, com menos “apagar incêndio” e mais entender o porquê.",
  },
  {
    icone: "relatorio" as const,
    titulo: "Com ou sem laudo",
    texto:
      "Atendemos crianças típicas e atípicas. A avaliação inicial serve justamente para entender o caso, com ou sem diagnóstico prévio.",
  },
  {
    icone: "espaco" as const,
    titulo: "Ciência, acolhimento e afeto",
    texto:
      "Terapia comportamental apoiada em Análise do Comportamento, com repetição afetuosa: a criança aprende novas habilidades sem perder o vínculo.",
  },
  {
    icone: "playground" as const,
    titulo: "Apoio que vai além da sessão",
    texto:
      "Orientação para pais e escola, mapeamento comportamental gratuito e guias escritos pela nossa psicóloga, para você não sair sozinha da reunião nem sozinha em casa.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Como funciona — CONFIANÇA (baixo atrito)
// ─────────────────────────────────────────────────────────────────────────

export const METODO = {
  titulo: "Como vai funcionar o primeiro contato",
  subtitulo: "Sem formulário longo e sem espera confusa. Três passos, no seu tempo.",
  passos: [
    {
      titulo: "Você chama no WhatsApp",
      texto: "Conta em poucas palavras o que está acontecendo. Sem burocracia.",
    },
    {
      titulo: "Conversa de acolhimento, sem rótulo",
      texto:
        "Você é ouvida antes de qualquer coisa. A gente entende a rotina da sua família, não só um sintoma.",
    },
    {
      titulo: "Um plano que cabe na sua rotina",
      texto:
        "Sem prazo fechado, sem promessa de resultado. Um caminho possível, ajustado com você.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Serviços — mesma lista do hub (/servicos)
// ─────────────────────────────────────────────────────────────────────────

export const SERVICOS = [
  {
    titulo: "Avaliação inicial e acolhimento",
    texto:
      "Para toda família que quer entender melhor o que está acontecendo, com ou sem laudo. Uma conversa e observação, sem pressa: você sai com um primeiro plano, não com uma lista de exames.",
  },
  {
    titulo: "Psicologia e terapia comportamental",
    texto:
      "Para crianças com birras frequentes, dificuldade de comunicação ou comportamentos que preocupam a família. Sessões que ensinam novas habilidades, apoiadas em Análise do Comportamento.",
  },
  {
    titulo: "Fonoaudiologia",
    texto:
      "Para fala atrasada, difícil de entender ou seletividade alimentar. Estímulo à fala, à linguagem e, quando necessário, à alimentação: mais formas de se entender com o seu filho.",
  },
  {
    titulo: "Terapia Ocupacional",
    texto:
      "Para dificuldade de coordenação, autonomia nas tarefas do dia ou hipersensibilidade a som, luz e toque. Integração sensorial para vestir, comer e escovar os dentes serem menos batalha.",
  },
  {
    titulo: "Psicopedagogia",
    texto:
      "Para dificuldade de aprendizagem em leitura, escrita ou matemática. Estratégias criadas para o jeito de aprender do seu filho, não o contrário.",
  },
  {
    titulo: "Avaliação neuropsicológica",
    texto:
      "Para dúvidas sobre memória, atenção, foco ou desenvolvimento cognitivo. Testes que mapeiam essas funções e orientam escola e terapia.",
  },
  {
    titulo: "Orientação a pais e escola",
    texto:
      "Sessões só com você para ajustar a rotina em casa e apoio na conversa com a coordenação pedagógica, quando fizer sentido.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Quem cuida — CONFIANÇA (responsável técnica com registro)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Só entra aqui quem tem registro profissional confirmado — nome sem registro
 * enfraquece a página. Novos profissionais entram na lista quando forem
 * confirmados; com um único item o layout vira o bloco de destaque.
 */
export const EQUIPE: Array<{
  nome: string;
  especialidade: string;
  registro: string;
  bio: string;
  foto: { src: string; largura: number; altura: number; alt: string };
  chips: string[];
}> = [
  {
    nome: "Isabella Gonçalves Freitas",
    especialidade: "Psicóloga infantil",
    registro: "CRP 10/4727",
    bio: "Idealizadora do FaçaAmigos e autora dos e-books O Brincar com Propósito e O Código do Desenvolvimento Infantil. Acredita que entender o comportamento de uma criança é sempre o primeiro passo para acolhê-la.",
    foto: {
      src: "/site/isabella.jpg",
      largura: 800,
      altura: 1067,
      alt: "Isabella Gonçalves Freitas, psicóloga infantil e idealizadora do FaçaAmigos, sorrindo ao lado de um cachorro",
    },
    chips: ["Desenvolvimento infantil", "Terapia comportamental", "Inclusão"],
  },
];

export const QUEM_CUIDA = {
  chapeu: "Quem cuida",
  titulo: "Uma psicóloga à frente, uma equipe ao lado.",
  nota: "Os demais profissionais serão apresentados aqui, com o registro de cada um, na abertura.",
};

// ─────────────────────────────────────────────────────────────────────────
// Ecossistema
// ─────────────────────────────────────────────────────────────────────────

export const ECOSSISTEMA = {
  chapeu: "Ecossistema FaçaAmigos",
  titulo: "Enquanto a clínica não abre, você já pode começar.",
  paragrafos: [
    "O Centro de Terapia Comportamental faz parte do FaçaAmigos: um ecossistema infantil inclusivo de Belém que também tem Playground Inclusivo e Circuito de carrinhos elétricos, no Parque Shopping.",
    "Sem esperar a abertura, você pode fazer o mapeamento comportamental gratuito (cerca de 5 minutos) e ler os guias escritos pela nossa psicóloga sobre birra, rotina e laudo.",
  ],
  cta: {
    rotulo: "Fazer o mapeamento grátis",
    href: HUB.mapeamento,
  },
  ctaSecundario: {
    rotulo: "Ler os guias",
    href: HUB.guias,
  },
  imagem: {
    src: "/site/playground.webp",
    largura: 784,
    altura: 803,
    alt: "Piscina de bolinhas, casinha de madeira e escorregador do FaçaAmigos Playground Inclusivo",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Depoimentos — vazio de propósito
// ─────────────────────────────────────────────────────────────────────────

/**
 * A clínica ainda não abriu: não há depoimento real. Quando houver, só entra
 * texto que a família tenha autorizado POR ESCRITO (é dado de saúde de
 * criança; autorização verbal não basta). Lista vazia esconde a seção.
 */
export const DEPOIMENTOS: Array<{ texto: string; autor: string; contexto: string }> = [];

// ─────────────────────────────────────────────────────────────────────────
// Convênios e atendimento particular — OFERTA
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convênios que a clínica anunciou no hub. Só aparecem aqui enquanto a tabela
 * `insurers` não tiver nenhum convênio ativo (page.tsx): depois do
 * credenciamento no sistema, a lista real passa a valer e esta some.
 */
export const CONVENIOS_NA_ABERTURA = ["IASEP", "PROASA"];

export const PLANOS = {
  chapeu: "Como pagar",
  titulo: "Convênios e atendimento particular",
  subtitulo:
    "A pergunta que mais chega é se o plano é atendido. Os convênios valem a partir da inauguração; deixe seu contato e a recepção confirma a cobertura e explica o que é a guia, antes de qualquer compromisso.",
  /** Mostrado quando não há nenhum convênio ativo cadastrado. */
  semLista:
    "Vamos atender os convênios IASEP e PROASA assim que a clínica abrir, além do atendimento particular. Os detalhes de cada convênio são confirmados na abertura.",
  aberturaRotulo: "na abertura",
  reembolso:
    "Não encontrou o seu? Emitimos nota fiscal e relatório para você pedir reembolso, e a recepção ajuda a montar essa documentação.",
  formulario: {
    titulo: "Consultar meu plano",
    subtitulo:
      "Deixe seu contato: a recepção confirma a cobertura e já te diz qual é o próximo passo.",
    botao: "Consultar meu plano",
    botaoEnviando: "Enviando...",
    sucessoTitulo: "Consulta recebida!",
    sucessoTexto:
      "Vamos te responder pelo WhatsApp com a situação do seu plano. Se a janela do WhatsApp não abrir sozinha, use o botão abaixo.",
    sucessoBotao: "Abrir conversa no WhatsApp",
    consentimento:
      "Ao enviar, você concorda em ser contatado pela nossa recepção sobre esta consulta. Seus dados são usados só para isso.",
  },
  campos: {
    plano: "Qual é o seu plano?",
    planoPlaceholder: "Selecione",
    planoOutroRotulo: "Meu plano não está na lista",
    planoParticularRotulo: "Particular / não tenho plano",
    planoOutroCampo: "Nome do seu plano",
    planoOutroPlaceholder: "Ex.: Unimed Belém",
  },
  /**
   * A bifurcação que a recepção precisa ANTES de ligar: com guia em mãos já
   * se agenda; sem guia, o contato é para orientar como conseguir. "Não sei
   * o que é" é a resposta mais comum de quem está começando agora.
   */
  guia: {
    pergunta: "Você já tem o pedido médico (guia) em mãos?",
    opcoes: [
      { valor: "sim", rotulo: "Já tenho" },
      { valor: "nao", rotulo: "Ainda não tenho" },
      { valor: "nao_sei", rotulo: "Não sei o que é isso" },
    ],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// FAQ — mesmas respostas do hub (/servicos)
// ─────────────────────────────────────────────────────────────────────────

export const FAQ = [
  {
    pergunta: "Já dá para agendar uma consulta na clínica?",
    resposta:
      "Ainda não. A clínica FaçaAmigos está em fase final de preparação. Você pode entrar na lista de espera pelo WhatsApp, sem custo, e é a primeira pessoa avisada assim que abrirmos.",
  },
  {
    pergunta: "A clínica atende só crianças autistas?",
    resposta:
      "Não. Atendemos crianças típicas e atípicas, com ou sem laudo, sempre que a família sente que precisa de apoio: birra frequente, atraso de fala, dificuldade na escola, entre outros motivos.",
  },
  {
    pergunta: "Preciso ter laudo para ser atendido?",
    resposta:
      "Não é obrigatório. A avaliação inicial e o acolhimento servem justamente para entender o caso, com ou sem laudo prévio.",
  },
  {
    pergunta: "A clínica atende convênio?",
    resposta:
      "Vamos atender os convênios IASEP e PROASA assim que abrirmos, além do atendimento particular. Os detalhes de cada convênio são confirmados na abertura. Se o seu plano for outro, a recepção explica como funciona o reembolso.",
  },
  {
    pergunta: "A partir de que idade a clínica atende?",
    resposta:
      "O acompanhamento é voltado para crianças; a idade exata de cada caso é conversada na avaliação inicial, de acordo com o serviço.",
  },
  {
    pergunta: "A avaliação é um diagnóstico?",
    resposta:
      "Não. A avaliação inicial e o acompanhamento são um apoio educativo e terapêutico. Eles não substituem, quando necessário, uma avaliação médica ou neuropsicológica formal.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// CTA final e rodapé — OFERTA
// ─────────────────────────────────────────────────────────────────────────

export const FECHAMENTO = {
  titulo: "Entre na lista de espera. Você é avisada assim que abrirmos.",
  subtitulo:
    "Não precisa decidir nada agora. Conte em poucas palavras o que está acontecendo, sem formulário longo: a recepção responde, confirma se o seu convênio é atendido e explica o próximo passo no seu tempo.",
  reforco:
    "Enquanto isso, o mapeamento comportamental gratuito (5 minutos) já te dá um primeiro retrato do dia a dia do seu filho.",
  garantia: "Sem custo para entrar na lista e sem compromisso de agendar.",
};

export const RODAPE = {
  frase: "Feito com cuidado para todas as famílias.",
  aviso:
    "Conteúdo educativo. Não constitui diagnóstico e não substitui a avaliação e o acompanhamento de profissionais de saúde.",
};

// ─────────────────────────────────────────────────────────────────────────
// Descrição Institucional (500 caracteres)
// ─────────────────────────────────────────────────────────────────────────

export const DESCRICAO_CLINICA_500 = {
  titulo: "Sobre a Clínica Faça Amigos",
  texto:
    "A Clínica Faça Amigos é especializada no desenvolvimento infantil integrativo, com foco no atendimento a crianças com Transtorno do Espectro Autista (TEA) e TDAH. Nossa equipe multidisciplinar atua com a Ciência ABA, Fonoaudiologia, Terapia Ocupacional e Psicopedagogia, oferecendo um ambiente acolhedor, seguro e estruturado. Unimos ciência, afeto e tecnologia para promover autonomia, inclusão e qualidade de vida para a criança e sua família, transformando cada etapa do desenvolvimento em conquistas reais.",
  caracteres: 494,
};
