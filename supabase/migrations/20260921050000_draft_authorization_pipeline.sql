-- Fila de pendências da Recepção como linha do tempo: cada contato que mandou
-- documentos (registration_drafts) passa por três etapas antes de virar
-- agendamento —
--   1) documentos recebidos          (já existia: arquivos + dados lidos)
--   2) autorização junto ao plano    (processo manual da clínica com o convênio;
--                                     a recepção marca "autorizada" e registra a guia)
--   3) habilitado para agendamento   (o "ok" que a Supervisão vê na Agenda 1ª Avaliação)
-- O estado mora no próprio rascunho porque o contato existe na fila antes de
-- haver paciente/convênio/guia em tabelas reais.

alter table registration_drafts
  add column plan_authorized_at timestamptz,
  add column plan_authorized_by uuid references profiles(id),
  -- Particular (ou convênio sem guia): pula a etapa 2 sem inventar guia — mesmo
  -- modelo de "particular = convênio sem guia" usado no resto do sistema.
  add column authorization_waived boolean not null default false,
  -- Guia autorizada pelo plano, com as mesmas chaves de extracted->authorization
  -- (guide_number, procedure_code, sessions_authorized, valid_from, valid_to,
  -- authorization_password, password_valid_until) para pré-preencher a tela de
  -- conferência do cadastro.
  add column authorized_guide jsonb,
  -- Guia real (authorizations) quando a guia já pôde ser gravada — evita a
  -- validação do cadastro inserir uma segunda guia igual.
  add column authorization_id uuid references authorizations(id),
  add column scheduling_enabled_at timestamptz,
  add column scheduling_enabled_by uuid references profiles(id);

comment on column registration_drafts.plan_authorized_at is
  'Etapa 2 da fila de pendências: o plano autorizou (marcado manualmente pela recepção).';
comment on column registration_drafts.scheduling_enabled_at is
  'Etapa 3 da fila de pendências: recepção liberou para a 1ª avaliação. A Agenda 1ª Avaliação da Supervisão só deixa agendar quem tem este "ok".';

-- Rascunhos já validados antes desta migration foram atendidos sem a etapa de
-- habilitação: entram como habilitados para não travar quem já está na
-- agenda nem reaparecer na fila.
update registration_drafts
   set scheduling_enabled_at = coalesce(validated_at, created_at)
 where status = 'validated'
   and scheduling_enabled_at is null;

create index registration_drafts_pipeline_idx on registration_drafts (patient_id)
  where status = 'validated' and scheduling_enabled_at is null;
