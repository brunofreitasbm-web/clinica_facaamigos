export type ReportType =
  | "clientes"
  | "terapias"
  | "planos"
  | "contratos"
  | "pts"
  | "profissionais"
  | "faturamento";

export type ReportColumnDef = {
  key: string;
  label: string;
  defaultSelected: boolean;
};

export type ReportFilterState = {
  reportType: ReportType;
  dateStart?: string;
  dateEnd?: string;
  periodPreset?: "30d" | "current_month" | "previous_month" | "90d" | "year" | "all" | "custom";
  status?: string;
  insurerId?: string;
  therapistId?: string;
  discipline?: string;
  modality?: string;
  searchTerm?: string;
  selectedColumns: string[];
};

export type FilterMetadata = {
  insurers: { id: string; name: string }[];
  therapists: { id: string; full_name: string; discipline: string | null }[];
  disciplines: string[];
  patientStatuses: { value: string; label: string }[];
  appointmentStatuses: { value: string; label: string }[];
  contractStatuses: { value: string; label: string }[];
  ptsStatuses: { value: string; label: string }[];
};

export type ReportConfig = {
  id: ReportType;
  title: string;
  subtitle: string;
  description: string;
  columns: ReportColumnDef[];
};

export const REPORT_CONFIGS: Record<ReportType, ReportConfig> = {
  clientes: {
    id: "clientes",
    title: "Clientes & Pacientes",
    subtitle: "Cadastro clínico, administrativo e dados de contato",
    description: "Exporta a base de pacientes com dados demográficos, responsáveis, convênios, nível de suporte e status.",
    columns: [
      { key: "full_name", label: "Nome do Paciente", defaultSelected: true },
      { key: "cpf", label: "CPF", defaultSelected: true },
      { key: "birth_date", label: "Data de Nascimento", defaultSelected: true },
      { key: "age", label: "Idade", defaultSelected: true },
      { key: "sexo", label: "Sexo", defaultSelected: true },
      { key: "status", label: "Status", defaultSelected: true },
      { key: "support_level", label: "Nível de Suporte (TEA)", defaultSelected: true },
      { key: "cid", label: "CID", defaultSelected: true },
      { key: "insurer_name", label: "Plano / Convênio", defaultSelected: true },
      { key: "card_number", label: "Nº Carteirinha", defaultSelected: true },
      { key: "guardian_name", label: "Responsável", defaultSelected: true },
      { key: "guardian_phone", label: "Telefone Responsável", defaultSelected: true },
      { key: "address_cidade", label: "Cidade", defaultSelected: false },
      { key: "address_bairro", label: "Bairro", defaultSelected: false },
      { key: "address_cep", label: "CEP", defaultSelected: false },
      { key: "entry_source", label: "Canal de Entrada", defaultSelected: false },
      { key: "created_at", label: "Data de Cadastro", defaultSelected: true },
    ],
  },
  terapias: {
    id: "terapias",
    title: "Terapias & Atendimentos",
    subtitle: "Grade de sessões, agendamentos e presenças",
    description: "Exporta sessões realizadas, agendadas, faltas e cancelamentos com especialidades, profissionais e horários.",
    columns: [
      { key: "session_date", label: "Data da Sessão", defaultSelected: true },
      { key: "time_range", label: "Horário", defaultSelected: true },
      { key: "patient_name", label: "Paciente", defaultSelected: true },
      { key: "patient_cpf", label: "CPF Paciente", defaultSelected: false },
      { key: "discipline", label: "Especialidade / Disciplina", defaultSelected: true },
      { key: "therapist_name", label: "Terapeuta", defaultSelected: true },
      { key: "therapist_council", label: "Conselho Terapeuta", defaultSelected: false },
      { key: "room_name", label: "Sala", defaultSelected: true },
      { key: "modality", label: "Modalidade", defaultSelected: true },
      { key: "status", label: "Status da Sessão", defaultSelected: true },
      { key: "session_type", label: "Tipo de Atendimento", defaultSelected: true },
      { key: "has_evolution", label: "Evolução Assinada", defaultSelected: true },
      { key: "guide_number", label: "Guia / Autorização", defaultSelected: false },
      { key: "cancel_reason", label: "Motivo Cancelamento / Falta", defaultSelected: false },
    ],
  },
  planos: {
    id: "planos",
    title: "Planos de Saúde & Convênios",
    subtitle: "Operadoras, carteirinhas vinculadas e particular",
    description: "Exporta a cobertura dos pacientes ativos e inativos, operadoras de saúde, registros ANS e carteirinhas.",
    columns: [
      { key: "patient_name", label: "Paciente", defaultSelected: true },
      { key: "patient_cpf", label: "CPF Paciente", defaultSelected: true },
      { key: "patient_status", label: "Status do Paciente", defaultSelected: true },
      { key: "is_private", label: "Tipo de Atendimento", defaultSelected: true },
      { key: "insurer_name", label: "Operadora / Convênio", defaultSelected: true },
      { key: "ans_code", label: "Registro ANS", defaultSelected: true },
      { key: "provider_code", label: "Código Prestador", defaultSelected: false },
      { key: "plan_name", label: "Nome do Plano / Categoria", defaultSelected: true },
      { key: "card_number", label: "Nº da Carteirinha", defaultSelected: true },
      { key: "card_valid_until", label: "Validade da Carteirinha", defaultSelected: true },
    ],
  },
  contratos: {
    id: "contratos",
    title: "Contratos & Mensalidades",
    subtitle: "Planos de atendimento contratados e valores",
    description: "Exporta contratos de prestação de serviços com mensalidades, dia de vencimento, vigência e status.",
    columns: [
      { key: "patient_name", label: "Paciente", defaultSelected: true },
      { key: "patient_cpf", label: "CPF Paciente", defaultSelected: true },
      { key: "plan_type", label: "Tipo de Plano / Modalidade", defaultSelected: true },
      { key: "monthly_fee", label: "Valor da Mensalidade (R$)", defaultSelected: true },
      { key: "payment_day", label: "Dia de Pagamento", defaultSelected: true },
      { key: "start_date", label: "Data de Início", defaultSelected: true },
      { key: "end_date", label: "Data de Fim", defaultSelected: true },
      { key: "status", label: "Status do Contrato", defaultSelected: true },
      { key: "notes", label: "Observações", defaultSelected: false },
    ],
  },
  pts: {
    id: "pts",
    title: "Planos Terapêuticos (PTS)",
    subtitle: "Evolução do Plano Terapêutico Singular",
    description: "Exporta os PTS de cada paciente com versão, objetivos gerais, datas de aprovação, entrega e revisão.",
    columns: [
      { key: "patient_name", label: "Paciente", defaultSelected: true },
      { key: "version", label: "Versão", defaultSelected: true },
      { key: "status", label: "Status do Plano", defaultSelected: true },
      { key: "general_objective", label: "Objetivo Geral", defaultSelected: true },
      { key: "approved_at", label: "Data de Aprovação", defaultSelected: true },
      { key: "delivered_at", label: "Data de Entrega", defaultSelected: true },
      { key: "family_accepted_at", label: "Aceite da Família", defaultSelected: true },
      { key: "review_due_at", label: "Próxima Revisão", defaultSelected: true },
      { key: "supervisor_notes", label: "Notas da Supervisão", defaultSelected: false },
    ],
  },
  profissionais: {
    id: "profissionais",
    title: "Equipe & Profissionais",
    subtitle: "Corpo clínico e colaboradores",
    description: "Exporta profissionais cadastrados com funções, especialidades, registros de conselho de classe e certificações.",
    columns: [
      { key: "full_name", label: "Nome Completo", defaultSelected: true },
      { key: "email", label: "E-mail", defaultSelected: true },
      { key: "phone", label: "Telefone", defaultSelected: true },
      { key: "role", label: "Cargo / Função", defaultSelected: true },
      { key: "discipline", label: "Especialidade / Disciplina", defaultSelected: true },
      { key: "council", label: "Conselho de Classe", defaultSelected: true },
      { key: "esdm_certified", label: "Certificação ESDM", defaultSelected: true },
      { key: "is_rt", label: "Responsável Técnico (RT)", defaultSelected: true },
      { key: "is_at_professional", label: "Atendente Terapêutico (AT)", defaultSelected: true },
      { key: "status", label: "Status", defaultSelected: true },
      { key: "created_at", label: "Data de Admissão", defaultSelected: false },
    ],
  },
  faturamento: {
    id: "faturamento",
    title: "Faturamento & Produção",
    subtitle: "Itens faturáveis, guias e competências",
    description: "Exporta sessões fechadas em competências para cobrança com códigos TUSS, valores e convênios.",
    columns: [
      { key: "competence_month", label: "Mês de Competência", defaultSelected: true },
      { key: "insurer_name", label: "Convênio", defaultSelected: true },
      { key: "patient_name", label: "Paciente", defaultSelected: true },
      { key: "card_number", label: "Carteirinha", defaultSelected: true },
      { key: "guide_number", label: "Número da Guia", defaultSelected: true },
      { key: "procedure_code", label: "Código TUSS", defaultSelected: true },
      { key: "service_date", label: "Data do Atendimento", defaultSelected: true },
      { key: "service_time", label: "Hora", defaultSelected: true },
      { key: "therapist_name", label: "Profissional", defaultSelected: true },
      { key: "therapist_council", label: "Conselho", defaultSelected: true },
      { key: "amount", label: "Valor (R$)", defaultSelected: true },
      { key: "status", label: "Status Fechamento", defaultSelected: true },
    ],
  },
};
