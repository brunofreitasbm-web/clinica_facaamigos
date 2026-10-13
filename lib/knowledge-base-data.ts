/**
 * Base de Conhecimento Estruturada para a Recepção da Clínica FaçaAmigos
 * Módulo: Recepção (Anti-Erro, Didático e Atualizado)
 * Versão 2.0 - Alinhada com as Funcionalidades Recentes do Sistema
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
  category: "agenda" | "chegada" | "pendencia" | "atendimento" | "paciente" | "documentos";
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
    title: "Gestão, Filtros e Confirmação da Grade Diária",
    summary: "Como navegar pela grade, filtrar por sala e terapeuta, confirmar presenças via WhatsApp e registrar faltas com motivos oficiais.",
    purpose: "Garantir 100% de ocupação das salas, prevenir ociosidade da equipe clínica e assegurar que todos os agendamentos possuam guia ativa e sala vinculada.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Abrir a tela 'Agenda do Dia' no primeiro horário do turno e conferir se o seletor está marcado na data de HOJE.",
        validation: "Conferir se a lista de sessões do dia foi carregada sem filtros acidentais de data passada."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Exibe a grade organizada por salas/horários com badges de status: 'A Confirmar' (amarelo), 'Confirmada' (verde), 'Na Espera' (azul), 'Em Atendimento' (roxo), 'Concluída' (cinza) e 'Falta' (vermelho).",
        validation: "Destacar com prioridade no topo da lista as sessões com status 'A Confirmar'."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Utilizar a Ação Rápida de WhatsApp para enviar mensagem padrão de confirmação para os responsáveis que ainda não responderam.",
        validation: "Conferir se o telefone cadastrado possui WhatsApp ativo antes do envio."
      },
      {
        step: 4,
        actor: "Recepcionista",
        action: "Caso a família comunique cancelamento, clicar no botão 'Registrar Falta/Cancelamento' e selecionar obrigatoriamente o motivo oficial (Ex: Doença com atestado, Viagem, Sem transporte, Imprevisto).",
        validation: "NUNCA deixar o campo de motivo em branco; o motivo oficial alimenta os indicadores de absenteísmo e relatórios de BI."
      }
    ],
    anti_error_rules: [
      "NUNCA exclua um agendamento da grade. Se o paciente desmarcar, use sempre 'Registrar Falta/Cancelamento' com o motivo real para preservar o histórico analítico.",
      "NUNCA agende uma nova sessão sem verificar se o paciente possui Guia de Autorização ATIVA com saldo suficiente de sessões.",
      "NUNCA altere o terapeuta de referência ou aloque uma sala diferente sem prévia validação da Supervisão Clínica."
    ],
    exceptions: [
      {
        situation: "Acompanhante chega com a criança para uma sessão que estava como 'A Confirmar' sem aviso prévio.",
        solution: "Verifique na ficha se a guia e a sala estão liberadas. Mude o status para 'Confirmado' e em seguida realize o Check-in presencial normalmente."
      },
      {
        situation: "Paciente registra 2 faltas consecutivas sem justificativa (Evasão Silenciosa).",
        solution: "O sistema sinaliza um alerta de evasão. Abra a conversa oficial do WhatsApp, envie a mensagem acolhedora de busca ativa e notifique a Supervisão Clínica."
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
    categoryLabel: "Chegada & Cupom",
    title: "Check-in Presencial, Cupom Térmico e Notificação Realtime",
    summary: "Acolhimento da criança TEA/TDAH, leitura de QR Code ou busca por CPF, emissão da senha/cupom físico e disparo de aviso instantâneo ao terapeuta.",
    purpose: "Reduzir o tempo de espera na recepção para < 3 minutos, emitir comprovante térmico de entrada para acompanhantes e notificar o terapeuta na sala sem ruídos sonoros nos corredores.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Cumprimentar a família e a criança pelo nome em tom suave e calmo, respeitando a sensibilidade sensorial de pacientes TEA.",
        validation: "Manter o ambiente de entrada tranquilo e sem estímulos sonoros excessivos."
      },
      {
        step: 2,
        actor: "Responsável",
        action: "Apresenta o QR Code no celular, informa o CPF do responsável ou utiliza o Totem de Autoatendimento.",
        validation: "Confirmar que a data e o horário do agendamento correspondem ao turno atual."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Clicar no botão 'Confirmar Chegada' na fila de chegadas pendentes ou na agenda.",
        validation: "Conferir a foto do paciente e se o acompanhante presente está na lista de 'Pessoas Autorizadas a Buscar/Acompanhar'."
      },
      {
        step: 4,
        actor: "Sistema",
        action: "Emite automaticamente o cupom térmico impresso (com nome da criança, acompanhante, terapeuta, sala e horário) e dispara notificação em tempo real no app do terapeuta ('Paciente na sala de espera').",
        validation: "Confirmar que o badge do paciente mudou para 'Aguardando na Espera' e que o terapeuta recebeu o aviso na sala."
      }
    ],
    anti_error_rules: [
      "NUNCA confirme a chegada de um paciente se ele não estiver FISICAMENTE presente na sala de espera da clínica.",
      "NUNCA autorize a entrada de terceiros que não constem na lista de acompanhantes autorizados da ficha do paciente sem autorização formal dos pais.",
      "NUNCA intergrite ou interfone de forma ruidosa nos corredores; a notificação do sistema já é entregue silenciosamente na tela do terapeuta."
    ],
    exceptions: [
      {
        situation: "Responsável esqueceu o documento e não possui o celular com o QR Code.",
        solution: "Digite o CPF do responsável ou pesquise o nome da criança no campo de Busca Rápida, confirme a data de nascimento e realize o 'Check-in Manual por CPF'."
      },
      {
        situation: "Impressora térmica de cupons desconectou ou está sem papel.",
        solution: "Conclua a confirmação de chegada no sistema para que o terapeuta receba o aviso digital na sala, e reponha a bobina térmica assim que possível."
      },
      {
        situation: "Criança entra em crise ou desregulação sensorial na recepção.",
        solution: "Direcione a família com gentileza para o espaço de acolhimento e regulação sensorial da clínica e envie um alerta prioritário para o terapeuta da sessão."
      }
    ],
    quick_buttons: [
      { label: "Ver Fila de Chegadas", action_type: "navigate", target_route: "/recepcao/chegadas" },
      { label: "Check-in Rápido por CPF", action_type: "modal", target_route: "chegada-modal" }
    ]
  },
  {
    id: "rec-pendencia-03",
    category: "pendencia",
    categoryLabel: "Central de Pendências",
    title: "Central de Pendências em 3 Faixas de Urgência & Renovação no Banco",
    summary: "Gestão visual de guias a vencer, saldo de sessões zerado e cadastros incompletos com painel widescreen de 27\" e renovação gravada no banco.",
    purpose: "Zerar o vazamento de receita e evitar glosas de planos de saúde, garantindo que guias e autorizações sejam renovadas diretamente no banco antes do vencimento.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Acessar a 'Central de Pendências' no menu superior ou pela aba da recepção.",
        validation: "Visualizar o painel widescreen organizado em 3 faixas visuais de urgência: Crítico, Atenção e Monitoramento."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Agrupa os alertas: Faixa Crítica (tarja vermelha: guias vencidas, saldo zero de sessões), Faixa de Atenção (tarja amarela: guias vencendo em ≤ 7 dias, saldo com < 3 sessões) e Monitoramento (azul/verde: termos TCLE pendentes, dados incompletos).",
        validation: "Trabalhar prioritariamente a coluna de itens Críticos no início do expediente."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Clicar no item da pendência para abrir o painel lateral de detalhe. Se for renovação de guia autorizada, clicar em 'Renovar Guia'.",
        validation: "Digitar o novo número da guia, datas de início/fim de vigência e o saldo total de sessões autorizadas."
      },
      {
        step: 4,
        actor: "Sistema",
        action: "Grava a renovação da autorização diretamente no banco de dados (Postgres) e resolve o alerta atomicamente, atualizando o saldo do paciente.",
        validation: "Confirmar que o alerta sumiu da faixa crítica e que o novo saldo aparece na ficha do paciente."
      }
    ],
    anti_error_rules: [
      "NUNCA resolva ou remova uma pendência de guia sem a comprovação do documento oficial do convênio ou aprovação formal do Faturamento.",
      "NUNCA permita atendimento de paciente com saldo zerado sem emissão de protocolo provisório de autorização.",
      "NUNCA deixe itens na faixa 'Crítico' sem tratativa ativa por mais de 24 horas."
    ],
    exceptions: [
      {
        situation: "Convênio atrasou o retorno da renovação da guia e o paciente tem atendimento agendado para hoje.",
        solution: "Consulte o setor de Faturamento. Havendo protocolo oficial de solicitação de renovação junto ao convênio, anexe o número do protocolo e libere temporariamente."
      },
      {
        situation: "O saldo de sessões exibido diverge do documento enviado pela família.",
        solution: "Abra a ficha do paciente em 'Documentos', confira o PDF da guia oficial e ajuste a quantidade autorizada conforme a declaração da operadora de saúde."
      }
    ],
    quick_buttons: [
      { label: "Ver Central de Pendências", action_type: "navigate", target_route: "/recepcao?tab=pendencias" },
      { label: "Filtrar Guias Vencendo", action_type: "filter", target_route: "/recepcao?filter=guias_vencendo" }
    ]
  },
  {
    id: "rec-atendimento-04",
    category: "atendimento",
    categoryLabel: "WhatsApp & Chatbot",
    title: "Central Omnichannel WhatsApp: Janela de 24h, Bot & PWA Mobile",
    summary: "Gestão da caixa de entrada Twilio, controle da janela de 24h da Meta, alternância entre bot e atendimento humano, e uso no desktop ou celular (/m/atendimento).",
    purpose: "Atender famílias com rapidez pelo canal oficial de WhatsApp, gerenciar a janela legal de 24 horas da Meta, pausar/retomar o chatbot e responder de qualquer lugar pelo PWA mobile.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Acessar a Central de Atendimento no computador ou no celular via PWA mobile em '/m/atendimento'.",
        validation: "Verificar a lista de conversas ativas com sinalizadores de quem enviou a última mensagem ('Você', 'Lead/Família', 'Bot')."
      },
      {
        step: 2,
        actor: "Recepcionista",
        action: "Conferir o indicador de Janela de 24 Horas da Meta: se estiver ativa (verde), enviar mensagem de texto livre; se expirada (laranja/vermelha), selecionar um Template Homologado para reativar contato.",
        validation: "Respeitar a política da Meta: fora da janela de 24h, apenas templates aprovados podem ser disparados."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Ao digitar uma resposta personalizada, o sistema pausa automaticamente o Chatbot para que o atendimento humano assuma o controle.",
        validation: "Manter tom gentil, profissional e alinhado com as diretrizes de acolhimento da clínica."
      },
      {
        step: 4,
        actor: "Recepcionista",
        action: "Após responder as dúvidas do responsável, clicar no botão 'Retomar Bot' para que o assistente volte a tirar dúvidas frequentes automaticamente.",
        validation: "Confirmar que a conversa voltou para o modo de supervisão automática."
      }
    ],
    anti_error_rules: [
      "NUNCA tente enviar mensagens de texto livre quando a janela de 24 horas estiver expirada; utilize sempre o botão de seleção de template oficial.",
      "NUNCA encerre um atendimento sem clicar em 'Retomar Bot' ou arquivar a conversa, evitando conversas pendentes silenciosas.",
      "NUNCA compartilhe prontuários médicos ou dados sensíveis de diagnósticos de terceiros pelo WhatsApp (conformidade estrita com a LGPD)."
    ],
    exceptions: [
      {
        situation: "Família enviou áudio ou foto de documento pelo WhatsApp.",
        solution: "Ouça o áudio no player integrado do chat ou visualize a imagem comprimida. Caso seja documento (carteirinha/laudo), direcione para a fila de rascunhos de pré-cadastro."
      },
      {
        situation: "Uso no celular em '/m/atendimento' precisa fechar gavetas ou modais.",
        solution: "O botão nativo de voltar do celular ou gesto de deslizar fecha a conversa e retorna para a lista sem recarregar a tela ou deslogar o usuário."
      },
      {
        situation: "Oscilação temporária de conexão com o webhook da Twilio.",
        solution: "O sistema opera com fila durável e fallback automático; as mensagens são enfileiradas e processadas assim que o serviço normalizar."
      }
    ],
    quick_buttons: [
      { label: "Inbox de Atendimento", action_type: "navigate", target_route: "/recepcao/atendimento" },
      { label: "Atendimento Mobile PWA", action_type: "navigate", target_route: "/m/atendimento" }
    ]
  },
  {
    id: "rec-paciente-05",
    category: "paciente",
    categoryLabel: "Leads & Pré-Cadastro",
    title: "Rascunhos de Pré-Cadastro com IA & Captação de Interessado Rápido",
    summary: "Revisão assistida de documentos enviados via WhatsApp pelo bot de anamnese e registro ágil de novos contatos presenciais na porta da clínica.",
    purpose: "Eliminar retrabalho de digitação manual convertendo leads do WhatsApp em pacientes validados com IA, e capturar interessados presenciais em menos de 30 segundos.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Acessar a fila de 'Pré-Cadastros' para conferir os cadastros iniciados automaticamente pelo bot de WhatsApp ou formulário web.",
        validation: "Visualizar os rascunhos com status 'Aguardando Revisão da Recepção'."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Exibe a tela comparativa: documento original enviado pela família (RG, Certidão, Carteirinha de Plano, Laudo Médico) lado a lado com os campos sugeridos pela IA.",
        validation: "Conferir visualmente nome completo, data de nascimento, CPF do responsável e número da carteirinha de saúde."
      },
      {
        step: 3,
        actor: "Recepcionista",
        action: "Ajustar qualquer caractere incorreto e clicar em 'Homologar Pré-Cadastro'. O sistema realiza checagem anti-duplicidade no banco de dados.",
        validation: "Garantir que a criança não possui cadastro prévio ativo por CPF ou Certidão de Nascimento."
      },
      {
        step: 4,
        actor: "Recepcionista",
        action: "Caso uma família compareça presencialmente na clínica sem agendamento buscando informações, clicar no botão flutuante 'Interessado Rápido'.",
        validation: "Preencher em 30 segundos: Nome da Criança, Nome do Responsável, WhatsApp e Queixa Principal para disparar o fluxo de acolhimento."
      }
    ],
    anti_error_rules: [
      "NUNCA aprove um rascunho de pré-cadastro sem conferir a nitidez dos documentos anexados.",
      "NUNCA crie cadastros em duplicidade; faça busca prévia por CPF ou data de nascimento antes de registrar um novo paciente.",
      "NUNCA dispense uma família interessada na porta da clínica sem colher os dados no botão 'Interessado Rápido'."
    ],
    exceptions: [
      {
        situation: "A IA não conseguiu reconhecer os dados de um laudo manuscrito.",
        solution: "Preencha os campos de diagnóstico e CID manualmente a partir da leitura direta da imagem do laudo e salve o rascunho."
      },
      {
        situation: "Responsável não possui CPF cadastrado ou é menor de idade.",
        solution: "Cadastre o documento do responsável legal devidamente comprovado pela certidão de tutela ou certidão de nascimento."
      }
    ],
    quick_buttons: [
      { label: "Ver Fila de Pré-Cadastros", action_type: "navigate", target_route: "/recepcao/pre-cadastros" },
      { label: "Interessado Rápido (Lead)", action_type: "modal", target_route: "interessado-rapido-modal" }
    ]
  },
  {
    id: "rec-documentos-06",
    category: "documentos",
    categoryLabel: "Uploads & Segurança",
    title: "Upload Seguro com Compressão no Cliente (WebP/PDF) & Conformidade",
    summary: "Como anexar laudos, guias TNE e termos TCLE com compressão automática no navegador, validação de bytes e garantia de privacidade LGPD.",
    purpose: "Garantir envio ultrarrápido de documentos mesmo em conexões instáveis, economizar armazenamento seguro e assegurar conformidade documental para faturamento e auditoria.",
    bpmn_flow: [
      {
        step: 1,
        actor: "Recepcionista",
        action: "Acessar a ficha do paciente -> Aba 'Documentos' -> Clicar em 'Anexar Documento' ou acionar o botão de upload na pendência.",
        validation: "Classificar a categoria correta: Guia TNE, Carteirinha de Plano, Laudo Médico com CID, Termo TCLE ou Documento Pessoal."
      },
      {
        step: 2,
        actor: "Sistema",
        action: "Aplica compressão otimizada no cliente: imagens são convertidas para WebP de alta nitidez e PDFs são compactados no navegador antes do upload.",
        validation: "O upload ocorre em fração de segundos sem sobrecarregar a memória do computador da recepção."
      },
      {
        step: 3,
        actor: "Sistema",
        action: "Executa validação no servidor (sniffing de bytes de segurança) para certificar que o arquivo é íntegro e autêntico, armazenando no Supabase Storage seguro.",
        validation: "Confirmar exibição da tag de verificação verde no arquivo anexado."
      },
      {
        step: 4,
        actor: "Recepcionista",
        action: "Caso seja Guia de Autorização, preencher número oficial, data de vigência e saldo de sessões correspondente.",
        validation: "Conferir o saldo contra o comprovante oficial da operadora antes de finalizar."
      }
    ],
    anti_error_rules: [
      "NUNCA faça upload de arquivos com partes cortadas, fotos embaçadas ou que impeçam a leitura do número da guia e carimbo médico.",
      "NUNCA anexe termos TCLE sem a assinatura física legível ou assinatura digital válida do responsável legal.",
      "NUNCA utilize pastas locais desprotegidas no computador da recepção para armazenar cópias de documentos de crianças (risco LGPD)."
    ],
    exceptions: [
      {
        situation: "Responsável enviou foto com sombra forte que oculta o número da carteirinha.",
        solution: "Solicite o reenvio de uma foto nítida e iluminada ou solicite a apresentação física da carteirinha no momento do check-in para foto no scanner."
      },
      {
        situation: "O arquivo em PDF está corrompido ou excede o limite permitido.",
        solution: "O sistema emitirá aviso de compressão. Peça à família o reenvio do documento original emitido pelo convênio."
      }
    ],
    quick_buttons: [
      { label: "Gestão de Documentos", action_type: "navigate", target_route: "/recepcao/documentos" },
      { label: "Anexar Nova Guia", action_type: "modal", target_route: "nova-guia-modal" }
    ]
  }
];
