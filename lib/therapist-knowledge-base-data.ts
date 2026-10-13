/**
 * Base de Conhecimento Estruturada para o Módulo Terapeuta / Evolução Clínica
 * Clínica FaçaAmigos
 * Versão 2.0 - Alinhada com as Funcionalidades Recentes do Sistema
 */

export interface ProcessStep {
  step: number;
  actor: string; // ex: "Terapeuta (PJ)", "Sistema", "Recepção", "Supervisor"
  action: string;
  validation: string; // Checagem de conformidade técnica/clínica
}

export interface ExceptionCase {
  situation: string;
  solution: string;
}

export interface TherapistKBArticle {
  id: string;
  category: "agenda" | "coleta" | "evolucao" | "midias" | "assinatura" | "prontuario" | "metricas";
  categoryLabel: string;
  title: string;
  summary: string;
  purpose: string;
  bpmn_flow: ProcessStep[];
  anti_error_rules: string[];
  exceptions: ExceptionCase[];
  quick_buttons: { label: string; action_type: string; target_route?: string }[];
}

export const THERAPIST_KB_DATA: TherapistKBArticle[] = [
  {
    id: "ter-agenda-01",
    category: "agenda",
    categoryLabel: "Agenda & Início",
    title: "Agenda Diária, Fila de Espera em Tempo Real & Início de Sessão",
    summary: "Como checar a fila no celular, identificar o paciente na espera após check-in da recepção e iniciar o atendimento com cronômetro de sala.",
    purpose: "Garantir pontualidade rigorosa, confirmação presencial da criança na sala de espera e sincronização em tempo real do mapa de ocupação de salas.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta (PJ)",
        action: "Abrir a tela 'Minha Agenda' no smartphone ou tablet ao iniciar o turno na clínica.",
        validation: "Conferir se todas as sessões agendadas para o dia estão com horário e sala corretos."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Atualiza o card do paciente para 'Aguardando na Espera' (badge verde/azul com carimbo de horário) assim que a recepção conclui o check-in presencial com cupom.",
        validation: "Confirmar que a família já chegou fisicamente antes de se deslocar à recepção."
      },
      {
        step: 3,
        actor: "Terapeuta (PJ)",
        action: "Buscar a criança na recepção ou espaço de acolhimento sensorial e clicar em 'Iniciar Sessão' no aplicativo.",
        validation: "Confirmar o disparo do cronômetro oficial de atendimento da sala no sistema."
      },
      {
        step: 4,
        actor: "Terapeuta (PJ)",
        action: "Ao navegar no celular durante o turno, utilizar o gesto ou botão nativo de voltar; o sistema fecha painéis e gavetas sem fechar a sessão em andamento.",
        validation: "Navegação fluida sem perda de dados na tela de atendimento."
      }
    ],
    anti_error_rules: [
      "NUNCA inicie o cronômetro da sessão no celular se o paciente ainda não estiver na sala com você.",
      "NUNCA busque uma criança na recepção sem conferir a identificação do acompanhante autorizado cadastrado na ficha.",
      "NUNCA troque de sala de atendimento sem atualizar o sistema ou comunicar imediatamente a Recepção e a Supervisão."
    ],
    exceptions: [
      {
        situation: "O paciente não realizou check-in até 10 minutos após o horário previsto.",
        solution: "Aguarde na sala e envie um aviso via sistema para a Recepção verificar se houve imprevisto no trânsito ou se a falta deve ser registrada."
      },
      {
        situation: "A criança apresenta desregulação sensorial ou recusa-se a entrar na sala.",
        solution: "Aplique o protocolo gradual de regulação no espaço infantil com o responsável e registre a intervenção de acolhimento na evolução."
      }
    ],
    quick_buttons: [
      { label: "Ver Minha Agenda", action_type: "navigate", target_route: "/terapeuta/agenda" },
      { label: "Sessões de Hoje", action_type: "navigate", target_route: "/terapeuta" }
    ]
  },
  {
    id: "ter-coleta-02",
    category: "coleta",
    categoryLabel: "Coleta ABA & ABC",
    title: "Coleta de Tentativas ABA em Tempo Real & Painel de Histórico (Trials)",
    summary: "Registro ágil de tentativas no celular (Independente, Dica, Incorreto), consulta à curva histórica e registro de crises comportamentais (ABC).",
    purpose: "Assegurar coleta precisa de dados empíricos de aprendizagem em tempo real, acompanhar a evolução dos programas do PEI e registrar eventos disruptivos de forma funcional.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta (PJ)",
        action: "Acessar a aba 'Folha de Registro ABA' no aplicativo durante a aplicação dos programas de ensino do PEI/PTS da criança.",
        validation: "Confirmar que as metas e programas ativos da especialidade estão carregados na tela."
      },
      {
        step: 2,
        actor: "Terapeuta (PJ)",
        action: "Tocar nos botões rápidos a cada bloco de tentativas (V: Independente, D: Com Dica, I: Incorreto).",
        validation: "O sistema calcula na hora a porcentagem de acertos e o nível de suporte exigido pela criança."
      },
      {
        step: 3,
        actor: "Terapeuta (PJ)",
        action: "Consultar o 'Painel de Histórico de Tentativas' para verificar a retenção e o gráfico de desempenho das sessões anteriores.",
        validation: "Identificar se o critério de aprendizagem do programa foi atingido para avanço de fase."
      },
      {
        step: 4,
        actor: "Terapeuta (PJ)",
        action: "Em caso de crise ou comportamento de interferência, acionar a aba 'Registro de Incidente / ABC' e preencher Antecedente, Comportamento e Consequência.",
        validation: "Descrever topografia e intensidade do comportamento de forma neutra e técnica (offline-first garantido)."
      }
    ],
    anti_error_rules: [
      "NUNCA invente ou registre tentativas de memória no fim do expediente; a coleta ABA deve ser contemporânea à atividade.",
      "NUNCA altere os critérios de esvanecimento de dicas sem aprovação da Supervisão Clínica do caso.",
      "NUNCA utilize adjetivos ou termos pejorativos ao registrar crises na folha ABC (descreva o comportamento observável)."
    ],
    exceptions: [
      {
        situation: "Queda na conexão Wi-Fi ou sinal 4G durante a coleta de tentativas.",
        solution: "Continue tocando nos botões normalmente. O sistema opera offline-first no dispositivo e sincroniza automaticamente assim que a conexão retornar."
      }
    ],
    quick_buttons: [
      { label: "Folha de Registro ABA", action_type: "navigate", target_route: "/terapeuta/evolucao" },
      { label: "Ver Metas do PEI", action_type: "navigate", target_route: "/terapeuta/pacientes" }
    ]
  },
  {
    id: "ter-evolucao-03",
    category: "evolucao",
    categoryLabel: "Evolução & Voz",
    title: "Evolução Clínica Rápida (≤ 2 min) & Ditado por Voz Inteligente",
    summary: "Como registrar a evolução em menos de 2 minutos usando metas estruturadas do PEI e o novo gravador com ditado por voz inteligente.",
    purpose: "Manter 100% de adesão no registro diário de evolução em conformidade com os conselhos de classe, eliminando burocracia com transcrição automática por voz.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta (PJ)",
        action: "Abrir o formulário de 'Nova Evolução Clínica' nos últimos 5 minutos do atendimento ou no intervalo imediato.",
        validation: "Conferir se data, horário, especialidade e dados do paciente foram carregados automaticamente."
      },
      {
        step: 2,
        actor: "Terapeuta (PJ)",
        action: "Marcar as metas trabalhadas nos checklists objetivos e assinalar a escala de engajamento do paciente.",
        validation: "Garantir que ao menos 1 meta homologada do plano terapêutico foi assinalada."
      },
      {
        step: 3,
        actor: "Terapeuta (PJ)",
        action: "Acionar o Gravador de Voz: tocar no microfone, ditar o resumo dos destaques da sessão no celular e finalizar a gravação.",
        validation: "O sistema transcreve o áudio em segundos e insere o resumo clínico estruturado no campo de texto."
      },
      {
        step: 4,
        actor: "Terapeuta (PJ)",
        action: "Fazer uma leitura rápida da transcrição, ajustar eventuais termos técnicos e revisar o resumo da sessão.",
        validation: "Garantir clareza, concisão e exatidão técnica antes de prosseguir para a assinatura."
      }
    ],
    anti_error_rules: [
      "NUNCA assine uma evolução gerada por voz sem fazer a conferência visual do texto transcrito.",
      "NUNCA encerre o turno de trabalho sem evoluir todas as sessões realizadas no dia (meta legal: concluir em até 24h).",
      "NUNCA copie e cole textos genéricos de sessões anteriores sem refletir os fatos reais do atendimento atual."
    ],
    exceptions: [
      {
        situation: "Ruído alto na sala impede a gravação nítida do ditado por voz.",
        solution: "Digite o resumo diretamente no campo de texto (2 a 3 frases objetivas com os principais avanços ou observações da sessão)."
      },
      {
        situation: "A sessão teve que ser interrompida por emergência médica ou mal-estar da criança.",
        solution: "Selecione o status 'Sessão Interrompida', descreva a conduta adotada e notifique imediatamente a Recepção e a Supervisão."
      }
    ],
    quick_buttons: [
      { label: "Evoluir Sessão Agora", action_type: "navigate", target_route: "/terapeuta/evolucao" },
      { label: "Ver Sessões do Dia", action_type: "navigate", target_route: "/terapeuta" }
    ]
  },
  {
    id: "ter-midias-04",
    category: "midias",
    categoryLabel: "Mídias & Fotos",
    title: "Registro Fotográfico de Atividades com Compressão Automática",
    summary: "Como anexar fotos de produções do paciente (desenhos, pareamentos, pranchas PECS) com compressão WebP ultrarrápida e conformidade LGPD.",
    purpose: "Documentar evidências visuais de evolução clínica e aprendizagem sem sobrecarregar o dispositivo do terapeuta e respeitando normas éticas e de privacidade.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta (PJ)",
        action: "Acessar a aba 'Mídias da Sessão' dentro do formulário de evolução.",
        validation: "Conferir se a atividade realizada gerou produto visual relevante (desenho, montagem motora, escrita, prancha de comunicação alternativa)."
      },
      {
        step: 2,
        actor: "Terapeuta (PJ)",
        action: "Tirar a foto pelo aplicativo ou anexar imagem da galeria do celular.",
        validation: "Enquadrar estritamente o material pedagógico ou a produção da criança (sem enquadrar rostos)."
      },
      {
        step: 3,
        actor: "Sistema",
        action: "Comprime a imagem automaticamente para o formato WebP direto no navegador antes de realizar o upload seguro para o storage.",
        validation: "Upload concluído em menos de 2 segundos, mesmo em redes móveis 4G."
      },
      {
        step: 4,
        actor: "Sistema",
        action: "Vincula a imagem ao prontuário eletrônico da sessão sob protocolo de acesso restrito à equipe multidisciplinar.",
        validation: "Confirmar visualização da miniatura com tag de compressão aprovada."
      }
    ],
    anti_error_rules: [
      "NUNCA fotografe o rosto da criança ou partes do corpo; o foco deve ser estritamente na produção ou recurso terapêutico.",
      "NUNCA fotografe outros pacientes que estejam no mesmo ambiente ou crachás de identificação de colaboradores.",
      "NUNCA compartilhe fotos de pacientes da clínica em redes sociais, mensagens pessoais ou fora do prontuário oficial (infração grave à LGPD)."
    ],
    exceptions: [
      {
        situation: "Navegador solicitou permissão de acesso à câmera do celular.",
        solution: "Conceda permissão de câmera nas configurações do navegador para permitir fotos diretas pelo app."
      }
    ],
    quick_buttons: [
      { label: "Ver Evolução Atual", action_type: "navigate", target_route: "/terapeuta/evolucao" }
    ]
  },
  {
    id: "ter-assinatura-05",
    category: "assinatura",
    categoryLabel: "PIN & Append-Only",
    title: "Assinatura Digital por PIN, Imutabilidade Legal & Adendos",
    summary: "Validação final da evolução com PIN individual, carimbo de tempo imutável (append-only) e retificação padronizada via adendos.",
    purpose: "Cumprir as exigências legais de prontuário eletrônico (CFM e LGPD art. 11), assegurando autoria, não repúdio e integridade total dos registros de saúde.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta (PJ)",
        action: "Conferir o resumo completo da evolução: metas trabalhadas, ditado de voz revisado e mídias anexadas.",
        validation: "Garantir a veracidade e exatidão das informações registradas."
      },
      {
        step: 2,
        actor: "Terapeuta (PJ)",
        action: "Digitar seu PIN de Assinatura Individual de 4 dígitos ou validar pela biometria do dispositivo.",
        validation: "Garantir uso estritamente pessoal e intransferível do PIN profissional."
      },
      {
        step: 3,
        actor: "Sistema",
        action: "Grava a evolução no banco de dados em formato imutável (append-only), aplicando assinatura criptográfica e carimbo de data/hora.",
        validation: "O registro torna-se permanente; nenhuma edição direta sobre o texto original é permitida."
      },
      {
        step: 4,
        actor: "Terapeuta (PJ)",
        action: "Caso seja necessário complementar ou corrigir uma informação após a assinatura, clicar no botão 'Adicionar Adendo de Correção'.",
        validation: "Digitar a nota de retificação com a justificativa técnica e assinar o adendo com o PIN."
      }
    ],
    anti_error_rules: [
      "NUNCA compartilhe seu PIN de assinatura profissional com outros terapeutas, estagiários ou recepcionistas.",
      "NUNCA tente apagar ou sobrescrever uma evolução já assinada; utilize exclusivamente 'Adicionar Adendo de Correção'.",
      "NUNCA assine a evolução de uma sessão que foi conduzida por outro colega sem a devida homologação da Coordenação."
    ],
    exceptions: [
      {
        situation: "Terapeuta esqueceu seu PIN de assinatura de 4 dígitos.",
        solution: "Acesse a opção 'Redefinir PIN de Assinatura' na tela de perfil para redefinir via código seguro de verificação."
      }
    ],
    quick_buttons: [
      { label: "Minha Assinatura / PIN", action_type: "navigate", target_route: "/terapeuta/metricas" }
    ]
  },
  {
    id: "ter-prontuario-06",
    category: "prontuario",
    categoryLabel: "PEI & Supervisão",
    title: "Prontuário Multidisciplinar, Metas do PEI/PTS & Notas da Supervisão",
    summary: "Como consultar o plano terapêutico da criança, orientações técnicas da coordenação e evoluções de outras especialidades.",
    purpose: "Manter alinhamento técnico contínuo entre fonoaudiologia, terapia ocupacional, psicologia e psicomotricidade, seguindo as diretrizes da coordenação clínica.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta (PJ)",
        action: "Buscar a criança na lista de 'Meus Pacientes' no aplicativo mobile.",
        validation: "Conferir foto, idade, laudo com CID e equipe multiprofissional vinculada."
      },
      {
        step: 2,
        actor: "Terapeuta (PJ)",
        action: "Abrir a aba 'Plano Terapêutico (PEI/PTS) & Metas' para revisar os estímulos e níveis de dica da especialidade.",
        validation: "Certificar-se de que os programas aplicados estão homologados pelo supervisor do caso."
      },
      {
        step: 3,
        actor: "Terapeuta (PJ)",
        action: "Verificar a caixa de 'Notas da Supervisão' antes de iniciar a sessão.",
        validation: "Checar se há orientações recentes de manejo comportamental ou ajustes metodológicos."
      },
      {
        step: 4,
        actor: "Terapeuta (PJ)",
        action: "Consultar as evoluções das outras especialidades para identificar o estado geral de engajamento do paciente na semana.",
        validation: "Garantir intervenção integrada e consistente entre toda a equipe da clínica."
      }
    ],
    anti_error_rules: [
      "NUNCA aplique procedimentos que divirjam das metas homologadas no PEI/PTS sem validação do Supervisor Clínico.",
      "NUNCA ignore as notas técnicas e orientações deixadas pela Supervisão.",
      "NUNCA exponha a tela do prontuário para outros acompanhantes na recepção ou corredores."
    ],
    exceptions: [
      {
        situation: "Dúvida sobre a aplicação de um novo programa de ensino ou adaptação sensorial.",
        solution: "Registre uma mensagem na aba 'Dúvida Técnica para Supervisão' no próprio app e solicite uma sessão de observação clínica compartilhada."
      }
    ],
    quick_buttons: [
      { label: "Meus Pacientes", action_type: "navigate", target_route: "/terapeuta/pacientes" },
      { label: "Histórico de Prontuário", action_type: "navigate", target_route: "/terapeuta/prontuario" }
    ]
  },
  {
    id: "ter-metricas-07",
    category: "metricas",
    categoryLabel: "Meta 24h & Repasse",
    title: "Meta de Evolução em 24h, Bonificação & Extrato de Repasse PJ",
    summary: "Acompanhamento do indicador de evolução no prazo (meta 100% em 24h), faixas de bonificação e conferência do repasse financeiro.",
    purpose: "Dar total transparência à produção do terapeuta parceiro, incentivar a pontualidade documental para faturamento ágil e disponibilizar canal direto de conferência de repasse.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta (PJ)",
        action: "Acessar a aba 'Minhas Métricas & Repasse' no menu do aplicativo.",
        validation: "Verificar a porcentagem de evoluções concluídas dentro do prazo estipulado de 24 horas."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Exibe o painel de produção com total de atendimentos realizados, faltas justificadas e taxa de pontualidade documental.",
        validation: "Calcular automaticamente a elegibilidade para a faixa de bonificação mensal por cumprimento de prazos."
      },
      {
        step: 3,
        actor: "Terapeuta (PJ)",
        action: "Conferir o extrato de repasse da competência vigente, discriminando sessões faturáveis computadas.",
        validation: "Verificar se todas as sessões realizadas no mês constam com status de evolução assinada."
      },
      {
        step: 4,
        actor: "Terapeuta (PJ)",
        action: "Caso identifique qualquer divergência de sessões, clicar em 'Contestar Lote de Sessões' diretamente no painel para abertura de chamado com o Faturamento.",
        validation: "Informar a data e o paciente em divergência para análise ágil do setor financeiro."
      }
    ],
    anti_error_rules: [
      "NUNCA acumule evoluções para o final de semana; evoluções com atraso superior a 24 horas impactam negativamente a bonificação do profissional e atrasam o faturamento da clínica.",
      "NUNCA conteste lotes de sessões sem antes confirmar se todas as evoluções da competência foram devidamente assinadas com PIN.",
      "NUNCA assine presenças em sessões nas quais houve falta do paciente sem registrar o motivo correspondente."
    ],
    exceptions: [
      {
        situation: "Divergência entre o número de sessões realizadas e o total computado no extrato.",
        solution: "Abra a contestação direta pelo painel de repasse informando as sessões faltantes para conciliação junto à recepção e faturamento."
      }
    ],
    quick_buttons: [
      { label: "Ver Minhas Métricas", action_type: "navigate", target_route: "/terapeuta/metricas" },
      { label: "Extrato de Repasse", action_type: "navigate", target_route: "/terapeuta/repasse" }
    ]
  }
];
