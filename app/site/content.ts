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
  assunto = "Olá! Vim pelo site do FaçaAmigos e gostaria de tirar uma dúvida.",
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
  { rotulo: "Planos", href: "#planos" },
  { rotulo: "Dúvidas", href: "#duvidas" },
  { rotulo: "Contato", href: "#agendar" },
];

/**
 * A porta de entrada da página é o WhatsApp, não um agendamento.
 *
 * Quem chega aqui pela primeira vez quase nunca quer marcar avaliação de
 * cara — quer saber se o plano dele é atendido (ver PLANOS abaixo e
 * lib/twilio-faq-bot.ts, onde essa é a pergunta campeã). Botão principal que
 * pede compromisso antes de responder a dúvida derruba conversão; por isso o
 * CTA primário abre a conversa e o secundário leva à consulta de convênio.
 */
export const CTA = {
  principal: "Falar no WhatsApp",
  principalApoio: "A gente responde no horário de funcionamento",
  secundario: "Ver planos atendidos",
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
// Planos de saúde — a pergunta mais frequente da clínica
// ─────────────────────────────────────────────────────────────────────────

/**
 * A lista de convênios NÃO é escrita aqui: ela é lida da tabela `insurers`
 * (só os `active`) em page.tsx, a mesma fonte que o bot de WhatsApp já usa em
 * `getAcceptedInsurersFormatted` (lib/twilio.ts). Credenciou um convênio no
 * sistema, ele aparece no site; descredenciou, some. Manter uma segunda lista
 * em texto aqui é o caminho garantido para o site prometer o que a clínica
 * não atende mais.
 *
 * O que fica neste arquivo é só a moldura de texto em volta da lista.
 */
export const PLANOS = {
  chapeu: "Convênios",
  titulo: "Seu plano de saúde é atendido aqui?",
  subtitulo:
    "É a pergunta que mais chega pra gente — então ela vem antes de qualquer agendamento. A lista abaixo sai direto do cadastro da clínica: se o seu plano está nela, está credenciado hoje.",
  /** Mostrado quando não há nenhum convênio ativo cadastrado. */
  semLista:
    "No momento o atendimento é particular. Emitimos nota fiscal e relatórios da equipe para você solicitar reembolso ao seu plano — e a recepção te ajuda a montar essa documentação.",
  reembolso:
    "Não encontrou o seu? Emitimos nota fiscal e relatório para reembolso, e todo plano perguntado aqui entra na nossa fila de novos credenciamentos.",
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
   * se agenda; sem guia, o contato é para orientar como conseguir. "Não sei o
   * que é" é a resposta mais comum de quem está começando agora — e é a que
   * mais precisa de uma pessoa do outro lado.
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
      "Sim, além do atendimento particular. A lista de convênios credenciados fica logo acima, na seção “Planos de saúde”, e sai direto do cadastro da clínica — se o seu plano estiver lá, está credenciado hoje. Não achou o seu? Consulte pelo formulário dessa seção: a recepção confirma a cobertura e explica o caminho do reembolso.",
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
  titulo: "Comece pela dúvida que você tem hoje.",
  subtitulo:
    "Não precisa decidir nada agora. Descubra primeiro se o seu plano é atendido — a recepção confirma a cobertura, explica o que é a guia e, só então, se fizer sentido, marca a primeira avaliação.",
  reforco:
    "Cada criança tem seu terapeuta na sessão, então a agenda é limitada. Quanto antes a gente conversar, mais cedo dá para reservar um horário.",
  garantia:
    "Nenhum dado seu vira cobrança: a consulta de plano é só uma resposta, no seu tempo.",
};

export const RODAPE = {
  frase: "Feito com cuidado para todas as famílias.",
};
