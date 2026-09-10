/**
 * Base de Conhecimento Estruturada para a Recepção da Clínica FaçaAmigos
 * Módulo: Recepção (Anti-Erro e Didático)
 */

export interface ProcessStep {
  step: number;
  actor: string; // ex: "Recepcionista", "Sistema/QR", "Responsável", "Terapeuta"
  action: string;
  validation: string; // Checagem anti-erro
}

export interface ExceptionCase {
  situation: string; // Ex: "Paciente chegou sem guia no sistema"
  solution: string;  // O que a recepção deve fazer passo a passo
}

export interface KBArticle {
  id: string;
  category: "agenda" | "chegada" | "paciente" | "pendencia" | "atendimento" | "documentos";
  categoryLabel: string;
  title: string;
  summary: string;
  purpose: string;
  bpmn_flow: ProcessStep[];
  anti_error_rules: string[];
  exceptions: ExceptionCase[];
  quick_buttons: { label: string; action_type: string; target_route?: string }[];
}

export const RECEPTION_KB_DATA: KBArticle[] = [
  {
    id: "rec-agenda-01",
    category: "agenda",
    categoryLabel: "Agenda do Dia",
    title: "Gestão e Confirmação da Agenda Diária",
    summary: "Como navegar, filtrar por sala/terapeuta e confirmar presenças para evitar buracos na grade.",
    purpose: "Garantir 100% de ocupação das salas, evitar faltas não comunicadas e assegurar que todas as sessões agendadas possuem guia autorizada.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Abrir a tela 'Agenda do Dia' no primeiro horário do turno.",
        validation: "Conferir se o filtro da data está marcado em HOJE."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Exibe a lista de sessões com badges de status (A Confirmar, Confirmada, Em Atendimento, Concluída, Falta).",
        validation: "Destacar em amarelo as sessões 'A Confirmar'."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Utilizar a Ação Rápida de WhatsApp para enviar mensagem de confirmação para os responsáveis que ainda não responderam.",
        validation: "Confirmar se o telefone tem WhatsApp ativo no cadastro."
      },
      {
        step: 4,
        actor: "Recepcionista",
        action: "Se o responsável informar cancelamento, clicar em 'Registrar Falta/Cancelamento' e escolher o motivo correto.",
        validation: "Obrigatoriamente selecionar o motivo oficial (Ex: Doença, Viagem, Sem Acompanhante). NUNCA deixar sem motivo."
      }
    ],
    anti_error_rules: [
      "NUNCA crie uma nova sessão na agenda sem verificar se o paciente tem Guia de Autorização ATIVA e com saldo de sessões.",
      "NUNCA exclua um agendamento. Se o paciente desmarcar, use o botão 'Cancelar Sessão' com o motivo real para alimentar os indicadores da gestão.",
      "NUNCA altere o terapeuta da sessão sem consultar a Supervisão Clínica."
    ],
    exceptions: [
      {
        situation: "Acompanhante chega para sessão que está como 'A Confirmar' sem ter avisado previamente.",
        solution: "Verifique se a guia e a sala estão liberadas. Mude o status para 'Confirmado' e em seguida realize o Check-in normalmente."
      },
      {
        situation: "Paciente falta 2 sessões seguidas sem justificativa.",
        solution: "Sinalize imediatamente a Pendência de Evasão Silenciosa para a Coordenação e envie mensagem padrão de acolhimento."
      }
    ],
    quick_buttons: [
      { label: "Ir para Agenda do Dia", action_type: "navigate", target_route: "/recepcao/agenda" },
      { label: "Ver Sessões a Confirmar", action_type: "filter", target_route: "/recepcao/agenda?status=a_confirmar" }
    ]
  },
  {
    id: "rec-chegada-02",
    category: "chegada",
    categoryLabel: "Na Chegada (Check-in)",
    title: "Recepção do Paciente e Check-in Anti-Erro",
    summary: "Recepção acolhedora do paciente TEA/TDAH, leitura de QR Code, identificação e aviso imediato ao terapeuta.",
    purpose: "Reduzir o tempo de espera na recepção para < 3 minutos, prevenir entrada de acompanhantes não autorizados e emitir a senha de presença.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Cumprimentar o responsável e a criança pelo nome de forma acolhedora e em tom suave.",
        validation: "Manter ambiente calmo (importante para regulação de pacientes com sensibilidade sensorial)."
      },
      {
        step: 2,
        actor: "Responsável",
        action: "Apresenta o QR Code no celular ou digita no totem / informa CPF do responsável.",
        validation: "Validar se o QR Code corresponde ao horário e data exatos do dia."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Clicar no botão 'Confirmar Chegada' na lista de Chegadas Pendentes.",
        validation: "Conferir a foto do paciente e o nome do acompanhante cadastrado."
      },
      {
        step: 4,
        actor: "Sistema",
        action: "Emite o cupom/senha física de atendimento e dispara notificação em tempo real no app do terapeuta.",
        validation: "Verificar se a notificação 'Paciente na Espera' foi entregue ao terapeuta na sala."
      }
    ],
    anti_error_rules: [
      "NUNCA confirme a chegada de um paciente se ele não estiver FISICAMENTE presente na sala de espera.",
      "NUNCA autorize a entrada de uma pessoa diferente dos pais sem verificar a lista de 'Pessoas Autorizadas a Buscar/Acompanhar' na ficha.",
      "NUNCA deixe a criança aguardando mais de 10 minutos sem avisar o terapeuta ou a supervisão."
    ],
    exceptions: [
      {
        situation: "Responsável esqueceu o documento e não tem o QR Code em mãos.",
        solution: "Busque pelo nome da criança no campo de Busca Rápida, confirme a data de nascimento e clique em 'Confirmar Chegada Manual'."
      },
      {
        situation: "O terapeuta está atrasado com a sessão anterior.",
        solution: "Acolha a família, ofereça o espaço de regulação infantil se necessário, e envie um alerta prioritário para o terapeuta e supervisão."
      }
    ],
    quick_buttons: [
      { label: "Ver Chegadas Pendentes", action_type: "navigate", target_route: "/recepcao/chegadas" },
      { label: "Check-in Rápido por CPF", action_type: "modal", target_route: "chegada-modal" }
    ]
  },
  {
    id: "rec-paciente-03",
    category: "paciente",
    categoryLabel: "Módulo Paciente",
    title: "Consulta de Ficha, Cadastro e Restrições",
    summary: "Como pesquisar a ficha da criança, consultar contatos de emergência, verificar laudo e garantir dados atualizados.",
    purpose: "Manter cadastro 100% completo, sem lacunas de contatos, dados de convênio ou alertas de saúde/alergia.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Digitar o nome, CPF do responsável ou carteirinha no campo de Busca Global.",
        validation: "Garantir busca sem erros de digitação (mínimo 3 caracteres)."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Exibe o Card do Paciente com Foto, Idade, Plano de Saúde, Tags de Alerta e Status da Anamnese.",
        validation: "Verificar a presença de badges como 'Alergia Alimentar' ou 'Restrição de Busca'."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Conferir se o WhatsApp do responsável principal está validado para envio de lembretes.",
        validation: "Confirmar DDD e número antes de salvar alterações."
      }
    ],
    anti_error_rules: [
      "NUNCA compartilhe informações da ficha da criança com terceiros que não estejam cadastrados como responsáveis legais (LGPD e Retenção Legal).",
      "NUNCA cadastre um paciente em duplicidade. Sempre busque por CPF ou Data de Nascimento antes de criar um novo pré-cadastro.",
      "NUNCA tente acessar prontuários clínicos ou evoluções (a recepção tem restrição RLS por papel e não visualiza dados médicos)."
    ],
    exceptions: [
      {
        situation: "Há ordem judicial ou restrição de custódia referente a um dos pais.",
        solution: "Verifique a tag de alerta vermelho na ficha do paciente. Se a pessoa restrita comparecer, avise imediatamente a gerência/direção."
      }
    ],
    quick_buttons: [
      { label: "Buscar Paciente", action_type: "navigate", target_route: "/recepcao/pacientes" },
      { label: "Novo Pré-Cadastro", action_type: "modal", target_route: "novo-paciente-modal" }
    ]
  },
  {
    id: "rec-pendencia-04",
    category: "pendencia",
    categoryLabel: "Na Pendência",
    title: "Gestão da Central de Pendências e Alertas",
    summary: "Como resolver guias com poucas sessões restantes, cadastros incompletos, documentos vencidos e evitar vazamento de receita.",
    purpose: "Zerar o vazamento de receita prevenindo atendimento sem guia vigente, falta de TCLE assinado ou guias expiradas.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Acessar o contador de 'Pendências' no topo da barra de navegação.",
        validation: "Verificar o número de itens com tarja vermelha (Crítico) e amarela (Atenção)."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Lista os alertas organizados por tipo: Guia prestes a vencer (<7 dias), Guia com saldo zero, Termo TCLE pendente.",
        validation: "Ordenar por prioridade alta para resolução imediata."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Clicar no item da pendência, acionar a família via WhatsApp com a mensagem padrão de solicitação e anexar o documento recebido.",
        validation: "Conferir se o arquivo anexado é legível antes de clicar em 'Marcar como Resolvido'."
      }
    ],
    anti_error_rules: [
      "NUNCA marque uma pendência como 'Resolvida' sem realizar o upload do documento comprobatório ou aprovação do faturamento.",
      "NUNCA libere sessões recorrentes para um paciente cuja guia expirou sem um protocolo de autorização provisória assinado."
    ],
    exceptions: [
      {
        situation: "O convênio atrasou a emissão da renovação da guia e a criança tem sessão hoje.",
        solution: "Verifique com o setor de Faturamento se há declaração de pedido de renovação protocolo. Caso aprovado pelo Faturamento, registre a liberação temporária."
      }
    ],
    quick_buttons: [
      { label: "Ver Central de Pendências", action_type: "navigate", target_route: "/recepcao?tab=pendencias" },
      { label: "Alertas de Guias Vencendo", action_type: "filter", target_route: "/recepcao?filter=guias_vencendo" }
    ]
  },
  {
    id: "rec-atendimento-05",
    category: "atendimento",
    categoryLabel: "No Atendimento",
    title: "Painel de Atendimento e Alocação de Salas",
    summary: "Acompanhamento em tempo real das sessões que estão em andamento, controle de tempo de sala e trocas de horários.",
    purpose: "Manter o fluxo de salas pontual, sem atrasos encadeados e com registro claro de onde cada criança se encontra.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Acompanhar o 'Painel de Atendimento em Andamento'.",
        validation: "Checar se o status da sessão mudou para 'Em Atendimento' quando a criança entrou na sala."
      },
      {
        step: 2,
        actor: "Terapeuta",
        action: "Inicia a sessão no app mobile ao buscar a criança na recepção.",
        validation: "Confirmar que o cronômetro da sala foi iniciado no painel."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Ao término do horário, conferir se a criança retornou à recepção acompanhada pelo terapeuta.",
        validation: "NUNCA deixar a criança sozinha no corredor ou desacompanhada."
      }
    ],
    anti_error_rules: [
      "NUNCA desaloque uma sala sem confirmar se o terapeuta anterior já finalizou a sessão com o paciente.",
      "NUNCA permita que um terapeuta leve uma criança para uma sala diferente da agendada sem atualizar o mapa de salas no sistema."
    ],
    exceptions: [
      {
        situation: "Terapeuta faltou por emergência e a criança já está na recepção.",
        solution: "Acione imediatamente a Supervisão Clínica para checar terapeuta de apoio/substituto disponível. Não cancele a sessão sem antes verificar substituição."
      }
    ],
    quick_buttons: [
      { label: "Painel de Atendimento", action_type: "navigate", target_route: "/recepcao/atendimento" },
      { label: "Mapa de Salas", action_type: "navigate", target_route: "/recepcao/atendimento?view=salas" }
    ]
  },
  {
    id: "rec-documentos-06",
    category: "documentos",
    categoryLabel: "Nos Documentos",
    title: "Anexo e Validação de Documentos Obrigatórios",
    summary: "Como anexar laudos médicos, carteirinhas de plano de saúde, guias de autorização TNE e termos TCLE.",
    purpose: "Garantir compliance legal (LGPD, normas de saúde) e impedir rejeições de faturamento por falta de comprovantes.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Receber a cópia ou foto do documento enviado pela família (Guia, Carteirinha, Laudo com CID, TCLE).",
        validation: "Checar se o nome da criança, data de nascimento e número do documento estão nítidos."
      },
      {
        step: 2,
        actor: "Recepcionista",
        action: "Abrir a aba 'Documentos' do Paciente -> Clicar em 'Anexar Documento'.",
        validation: "Classificar na categoria correta (Guia TNE, Carteirinha, Laudo Medico, Termo TCLE, RG/CPF)."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Se for uma Guia de Convenio, preencher os campos: Número da Guia, Validade Inicial/Final e Saldo de Sessões.",
        validation: "Conferir o número de sessões autorizadas contra o documento oficial enviado pelo plano."
      }
    ],
    anti_error_rules: [
      "NUNCA faça upload de arquivos com corte de margem, borrões ou que impeçam a leitura do número da guia e assinatura médica.",
      "NUNCA cadastre a validade de uma guia com data futura incorreta.",
      "NUNCA arquive o termo TCLE sem a assinatura digital ou física do responsável legal."
    ],
    exceptions: [
      {
        situation: "O arquivo enviado pelo responsável via WhatsApp está em baixa resolução.",
        solution: "Solicite o envio novamente em formato PDF ou tire uma foto presencial legível com o scanner/tablet da recepção."
      }
    ],
    quick_buttons: [
      { label: "Gestão de Documentos", action_type: "navigate", target_route: "/recepcao/documentos" },
      { label: "Anexar Nova Guia", action_type: "modal", target_route: "nova-guia-modal" }
    ]
  }
];
