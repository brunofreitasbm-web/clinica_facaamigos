/**
 * Base de Conhecimento Estruturada para o Módulo de Supervisão / Coordenação Clínica
 * Clínica FaçaAmigos
 */

export interface ProcessStep {
  step: number;
  actor: string; // ex: "Supervisor Clínico", "Terapeuta", "Recepção", "Sistema", "Família"
  action: string;
  validation: string; // Checagem de conformidade clínica
}

export interface ExceptionCase {
  situation: string;
  solution: string;
}

export interface SupervisionKBArticle {
  id: string;
  category: "acolhimento" | "grade" | "planos" | "avaliacoes" | "reunioes" | "prontuario";
  categoryLabel: string;
  title: string;
  summary: string;
  purpose: string;
  bpmn_flow: ProcessStep[];
  anti_error_rules: string[];
  exceptions: ExceptionCase[];
  quick_buttons: { label: string; action_type: string; target_route?: string }[];
}

export const SUPERVISION_KB_DATA: SupervisionKBArticle[] = [
  {
    id: "sup-acolhimento-01",
    category: "acolhimento",
    categoryLabel: "Acolhimento & Triagem",
    title: "Triagem de Leads e Anamnese de Entrada",
    summary: "Como analisar a demanda inicial da família, laudos prévios, disponibilidade de horário e direcionar para avaliação multiprofissional.",
    purpose: "Garantir o alinhamento de expectativa com a família, triagem adequada das necessidades da criança e agendamento rápido da avaliação inicial.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Supervisor Clínico",
        action: "Acessar o Painel de Acolhimentos / Inbox de Leads.",
        validation: "Verificar se os dados do responsável e hipótese diagnóstica/CID foram preenchidos."
      },
      {
        step: 2,
        actor: "Supervisor Clínico",
        action: "Revisar o histórico escolar, relatórios médicos prévios e queixas principais relatadas na pré-anamnese.",
        validation: "Confirmar se há laudo médico anexado ou indicação de investigação TEA/TDAH."
      },
      {
        step: 3,
        actor: "Supervisor Clínico",
        action: "Definir a grade de disciplinas recomendadas para a avaliação inicial (ABA, Fono, TO, Psicopedagogia).",
        validation: "Verificar disponibilidade na grade e compatibilidade do plano de saúde/convenio."
      },
      {
        step: 4,
        actor: "Sistema",
        action: "Dispara a confirmação de agendamento de avaliação para a Recepção e Família.",
        validation: "Confirmar criação dos slots de avaliação na agenda."
      }
    ],
    anti_error_rules: [
      "NUNCA aprove o encaminhamento de um lead para terapia continuada sem antes realizar a Avaliação Diagnóstica Multiprofissional.",
      "NUNCA prometa horários de grade à família antes da confirmação de vaga ativa pelo sistema de disponibilidade de salas e terapeutas.",
      "NUNCA inicie o acolhimento sem verificar a vigência da guia de autorização de avaliação emitida pelo convênio."
    ],
    exceptions: [
      {
        situation: "A criança apresenta comportamentos de severa desregulação ou crise na chegada.",
        solution: "Acione o protocolo de acolhimento prioritário em sala sensorial com terapeuta sênior e agende escuta individualizada com os pais."
      },
      {
        situation: "Família com indicação judicial ou liminar para início imediato.",
        solution: "Notifique a Gestão/Direção e utilize a fila de prioridade jurídica para alocação rápida de vaga."
      }
    ],
    quick_buttons: [
      { label: "Painel de Acolhimentos", action_type: "navigate", target_route: "/supervisao?tab=acolhimento" },
      { label: "Ver Leads Pendentes", action_type: "filter", target_route: "/supervisao?filter=leads_pendentes" }
    ]
  },
  {
    id: "sup-grade-02",
    category: "grade",
    categoryLabel: "Grade & Vagas",
    title: "Gestão de Grade Semanal e Alocação de Terapeutas",
    summary: "Montagem de horários fixos de sessões recorrentes, pareamento de perfil de terapeuta e gestão de faltas com substituição.",
    purpose: "Maximizar a ocupação técnica das salas, evitar janelas ociosas na agenda e garantir que cada paciente receba a carga horária recomendada no laudo.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Supervisor Clínico",
        action: "Abrir o Painel de Grade Horária e Mapa de Salas.",
        validation: "Filtrar por especialidade (Psicologia ABA, Fonoaudiologia, Terapia Ocupacional)."
      },
      {
        step: 2,
        actor: "Supervisor Clínico",
        action: "Analisar o perfil do paciente e realizar o pareamento com o terapeuta adequado.",
        validation: "Garantir compatibilidade técnica de experiência do terapeuta com as metas do paciente."
      },
      {
        step: 3,
        actor: "Supervisor Clínico",
        action: "Alocar os blocos recorrentes na grade semanal da clínica.",
        validation: "Validar se não há conflito de sala nem choque de horário do terapeuta."
      },
      {
        step: 4,
        actor: "Sistema",
        action: "Atualiza a agenda do terapeuta no app mobile e notifica a Recepção para emissão dos termos.",
        validation: "Verificar se as sessões recorrentes aparecem na agenda do dia."
      }
    ],
    anti_error_rules: [
      "NUNCA aloque um paciente em grade sem verificar se a Guia de Tratamento Continuado tem quantidade de sessões suficiente.",
      "NUNCA altere o terapeuta de referência de um paciente com TEA sem realizar a transição orientada de vínculo.",
      "NUNCA deixe uma ausência planejada de terapeuta sem designar um substituto devidamente alinhado com o plano terapêutico."
    ],
    exceptions: [
      {
        situation: "Terapeuta faltou por atestado no início do turno.",
        solution: "Verifique no painel de disponibilidade os terapeutas de apoio/supervisores disponíveis para assumir o bloco ou autorize o reagendamento emergencial."
      }
    ],
    quick_buttons: [
      { label: "Ver Grade Horária", action_type: "navigate", target_route: "/supervisao?tab=grade" },
      { label: "Mapa de Disponibilidade", action_type: "navigate", target_route: "/supervisao/disponibilidade" }
    ]
  },
  {
    id: "sup-planos-03",
    category: "planos",
    categoryLabel: "Planos Terapêuticos (PEI/PTS)",
    title: "Homologação e Revisão de Planos Terapêuticos",
    summary: "Validação clínica das metas SMART, escolha de protocolos (VB-MAPP, ABLLS-R, ESDM) e aprovação do Plano de Ensino Individualizado.",
    purpose: "Garantir rigor científico na intervenção ABA/Multidisciplinar, alinhar metas à funcionalidade da criança e liberar o plano para a família.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Terapeuta",
        action: "Submete o rascunho do Plano Terapêutico Singular (PTS/PEI) no sistema após o período de avaliação.",
        validation: "Verificar se todas as áreas do desenvolvimento aplicáveis foram preenchidas."
      },
      {
        step: 2,
        actor: "Supervisor Clínico",
        action: "Acessar a fila de 'Planos Pendentes de Aprovação'.",
        validation: "Revisar se as metas foram formuladas no formato SMART (Específica, Mensurável, Atingível, Relevante, Temporal)."
      },
      {
        step: 3,
        actor: "Supervisor Clínico",
        action: "Aprovar o plano ou solicitar ajustes indicando as orientações técnicas na caixa de revisão.",
        validation: "Caso aprovado, o plano torna-se a diretriz oficial de coleta de dados no app do terapeuta."
      },
      {
        step: 4,
        actor: "Sistema",
        action: "Gera a versão simplificada para apresentação na Reunião de Família.",
        validation: "Confirmar que a versão dos pais oculta jargões clínicos excessivamente técnicos."
      }
    ],
    anti_error_rules: [
      "NUNCA aprove um plano terapêutico sem metas operacionais claras e instrumentos de medição definidos.",
      "NUNCA libere o plano para assinatura da família sem a validação formal do Supervisor responsável pelo caso.",
      "NUNCA permita a continuidade de atendimentos por mais de 30 dias sem que haja um PTS/PEI aprovado e vigente no sistema."
    ],
    exceptions: [
      {
        situation: "O terapeuta não enviou a revisão dentro do prazo estipulado (14 dias pós-avaliação).",
        solution: "O sistema sinaliza alerta amarelo de evolução atrasada. O Supervisor deve convocar o terapeuta para sessão de mentoria clínica presencial."
      }
    ],
    quick_buttons: [
      { label: "Ver Planos Pendentes", action_type: "navigate", target_route: "/supervisao?tab=planos" },
      { label: "Modelos de PTS/PEI", action_type: "navigate", target_route: "/supervisao/planos?view=templates" }
    ]
  },
  {
    id: "sup-avaliacoes-04",
    category: "avaliacoes",
    categoryLabel: "Avaliações & Relatórios",
    title: "Gestão do Ciclo de Avaliação e Laudos Clínicos",
    summary: "Acompanhamento das sessões de avaliação, controle de prazos de relatórios multiprofissionais e homologação técnica.",
    purpose: "Entregar relatórios diagnósticos rigorosos, dentro do prazo legal e com alto valor clínico para médicos e operadoras de saúde.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Supervisor Clínico",
        action: "Acompanhar a 'Agenda de Avaliações' e status dos protocolos em andamento.",
        validation: "Conferir se o paciente concluiu a quantidade de sessões de avaliação prescritas."
      },
      {
        step: 2,
        actor: "Equipe Multidisciplinar",
        action: "Consolida as pontuações dos testes e envia o relatório integrado no sistema.",
        validation: "Anexar gráficos de desempenho dos protocolos aplicados."
      },
      {
        step: 3,
        actor: "Supervisor Clínico",
        action: "Realizar a revisão técnica final do relatório multiprofissional.",
        validation: "Checar coerência entre o diagnóstico funcional e a carga horária de intervenção sugerida."
      },
      {
        step: 4,
        actor: "Supervisor Clínico",
        action: "Assinar o relatório e agendar a Reunião de Devolutiva com a família.",
        validation: "Liberar o documento no portal com proteção por assinatura digital."
      }
    ],
    anti_error_rules: [
      "NUNCA assine um relatório multiprofissional sem conferir se todas as especialidades envolvidas emitiram os pareceres individuais.",
      "NUNCA emita sugestão de carga horária sem respaldo fundamentado na gravidade dos prejuízos funcionais observados nos testes."
    ],
    exceptions: [
      {
        situation: "Falta recorrente da criança durante a fase de avaliação.",
        solution: "Reagende a avaliação e notifique os pais sobre o risco de expirar a autorização da guia enviando alerta pelo WhatsApp da Recepção."
      }
    ],
    quick_buttons: [
      { label: "Agenda de Avaliações", action_type: "navigate", target_route: "/supervisao?tab=avaliacoes" },
      { label: "Revisão de Relatórios", action_type: "filter", target_route: "/supervisao?filter=relatorios_pendentes" }
    ]
  },
  {
    id: "sup-reunioes-05",
    category: "reunioes",
    categoryLabel: "Reuniões & Devolutivas",
    title: "Condução de Devolutivas e Alinhamento Familiar",
    summary: "Agendamento e registro de reuniões periódicas de alinhamento com os pais, apresentação de resultados e tratamento de feedbacks (NPS).",
    purpose: "Manter a família como parceira do processo terapêutico, alinhar o manejo comportamental no ambiente doméstico e mitigar insatisfações.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Supervisor Clínico",
        action: "Identificar os casos com ciclo de 6 meses vencido ou demanda de alinhamento emergencial.",
        validation: "Conferir o indicador de NPS/Alertas de feedback da família."
      },
      {
        step: 2,
        actor: "Supervisor Clínico",
        action: "Agendar a reunião presencial ou online com os responsáveis através do painel de Reuniões.",
        validation: "Enviar convite com link de vídeo ou confirmação de sala física."
      },
      {
        step: 3,
        actor: "Supervisor Clínico",
        action: "Apresentar a evolução das metas em linguagem acessível (gráficos de progresso simplificados).",
        validation: "Registrar a ata da reunião e os compromissos assumidos pela família para generalização em casa."
      },
      {
        step: 4,
        actor: "Responsável",
        action: "Assina o termo de ciência da devolutiva no portal da família.",
        validation: "Confirmar o recebimento do feedback pós-reunião."
      }
    ],
    anti_error_rules: [
      "NUNCA exponha evoluções clínicas brutas ou linguagens extremamente técnicas sem a devida explicação e contextualização para os pais.",
      "NUNCA ignore um alerta vermelho de insatisfação/NPS do responsável. Entre em contato em até 24 horas úteis para escuta ativa."
    ],
    exceptions: [
      {
        situation: "Família em discórdia sobre o manejo da criança entre os responsáveis separados.",
        solution: "Mantenha postura estritamente técnica e neutra, registrando as orientações por escrito no prontuário e focando no bem-estar da criança."
      }
    ],
    quick_buttons: [
      { label: "Painel de Reuniões", action_type: "navigate", target_route: "/supervisao/reunioes" },
      { label: "Alertas de NPS & Feedback", action_type: "navigate", target_route: "/supervisao?tab=nps" }
    ]
  },
  {
    id: "sup-prontuario-06",
    category: "prontuario",
    categoryLabel: "Prontuário & Auditoria",
    title: "Auditoria Clínica e Supervisão da Carteira",
    summary: "Monitoramento contínuo das evoluções assinadas pelos terapeutas, checagem de frequência de coleta de dados e acompanhamento de intercorrências.",
    purpose: "Assegurar 100% de regularidade nos registros clínicos, prevenir atrasos na documentação e garantir qualidade em todos os atendimentos.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Supervisor Clínico",
        action: "Acessar o Prontuário Unificado e o Monitor de Evoluções Atrasadas.",
        validation: "Identificar terapeutas com registros pendentes além do prazo de 24 horas."
      },
      {
        step: 2,
        actor: "Supervisor Clínico",
        action: "Realizar amostragem semanal de auditoria nas folhas de registro ABA e relatórios de atendimento multidisciplinar.",
        validation: "Checar se a coleta de dados de metas corresponde ao número de tentativas realizadas."
      },
      {
        step: 3,
        actor: "Supervisor Clínico",
        action: "Caso identificada inconsistência técnica ou desvio de protocolo, abrir um registro de 'Orientação de Supervisão'.",
        validation: "Agendar sessão individual de feedback com o terapeuta."
      }
    ],
    anti_error_rules: [
      "NUNCA altere ou edite uma evolução registrada por um terapeuta (as evoluções são append-only por regra legal e RLS). Adicione sempre uma nota de supervisão vinculada.",
      "NUNCA permança mais de 15 dias sem auditar a carteira de pacientes sob sua responsabilidade técnica direta."
    ],
    exceptions: [
      {
        situation: "Registro de intercorrência comportamental grave durante a sessão.",
        solution: "Abra a Ficha de Incidente no Prontuário Unificado, notifique o responsável e convoque a equipe multidisciplinar para revisão do plano de análise funcional."
      }
    ],
    quick_buttons: [
      { label: "Prontuário Unificado", action_type: "navigate", target_route: "/supervisao/prontuario-unificado" },
      { label: "Evoluções Atrasadas", action_type: "navigate", target_route: "/supervisao?tab=prontuario" }
    ]
  }
];
