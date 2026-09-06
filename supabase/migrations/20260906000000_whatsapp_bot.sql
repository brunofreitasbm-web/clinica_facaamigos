-- supabase/migrations/20260906000000_whatsapp_bot.sql
-- Chatbot WhatsApp (Twilio): coleta de dados do responsável, laudo/guia em
-- PDF, aprovação do supervisor e agendamento autônomo da avaliação/anamnese.
--
-- Todas as escritas destas tabelas (e do bot em geral) vêm de webhook/Server
-- Action sem sessão de usuário (auth.uid() é null) — por isso não há policy
-- de insert/update pra roles de app: só `createAdminClient()` (service-role)
-- escreve, mesmo padrão de app/recepcao/agenda/session-actions.ts.

-- ── Configuração da clínica (endereço, horário, avaliador, duração) ───────
create table clinic_settings (
  clinic_id uuid primary key references clinics(id),
  address text,
  opening_hours text,
  human_contact_phone text,
  evaluation_supervisor_profile_id uuid references profiles(id),
  evaluation_duration_minutes int not null default 60,
  evaluation_weekdays int[] not null default '{1,2,3,4,5}',
  evaluation_start_hour int not null default 8,
  evaluation_end_hour int not null default 18,
  bot_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table clinic_settings enable row level security;

create policy clinic_settings_read on clinic_settings for select
  using (clinic_id = current_clinic_id());
create policy clinic_settings_manage_gestor on clinic_settings for all
  using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

-- Seed pra clínica de desenvolvimento (mesmo padrão de outras migrations —
-- ex.: rooms em supabase/seed.sql — usar DEV_CLINIC_ID de lib/constants.ts).
insert into clinic_settings (clinic_id, address, opening_hours, human_contact_phone)
values (
  'c0000000-0000-0000-0000-000000000001',
  'Endereço a definir — configure em /gestor/integracoes/whatsapp',
  'Segunda a sexta, 8h às 18h',
  null
)
on conflict (clinic_id) do nothing;

-- ── Conversa do WhatsApp (pré-lead) ────────────────────────────────────────
-- `messages.patient_id` é NOT NULL (não dá pra logar turno de conversa antes
-- de existir paciente) — esta tabela existe justamente pra cobrir o período
-- antes do lead ser criado, guardando os dados coletados em `context` até lá.
create table whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  wa_id text not null,
  profile_name text,
  state text not null default 'menu',
  context jsonb not null default '{}'::jsonb,
  patient_id uuid references patients(id),
  guardian_id uuid references guardians(id),
  consent_at timestamptz,
  last_inbound_at timestamptz,
  window_expires_at timestamptz,
  human_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, wa_id)
);

alter table whatsapp_conversations enable row level security;

create policy whatsapp_conversations_read on whatsapp_conversations for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor','recepcao'));

-- ── Log bruto de mensagens (idempotência via provider_sid) ─────────────────
-- Não guarda MediaUrl nem payload cru do Twilio (minimização LGPD) — só o
-- necessário pra exibir o transcript no simulador/painel.
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations(id),
  direction text not null check (direction in ('inbound','outbound')),
  provider_sid text,
  body text,
  media_count int not null default 0,
  content_sid text,
  status text,
  created_at timestamptz not null default now()
);

create unique index whatsapp_messages_provider_sid_unique
  on whatsapp_messages(provider_sid) where provider_sid is not null;
create index whatsapp_messages_conversation_idx on whatsapp_messages(conversation_id, created_at);

alter table whatsapp_messages enable row level security;

create policy whatsapp_messages_read on whatsapp_messages for select
  using (
    exists (
      select 1 from whatsapp_conversations c
      where c.id = whatsapp_messages.conversation_id
        and c.clinic_id = current_clinic_id()
    )
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

-- ── Pedido de aprovação do supervisor (laudo + guia) ───────────────────────
create table evaluation_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  conversation_id uuid not null references whatsapp_conversations(id),
  patient_id uuid not null references patients(id),
  guardian_id uuid not null references guardians(id),
  laudo_document_id uuid references documents(id),
  guia_document_id uuid references documents(id),
  llm_check jsonb not null default '{}'::jsonb,
  status text not null default 'pendente'
    check (status in ('pendente','aprovada','rejeitada','agendada')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  appointment_id uuid references appointments(id),
  created_at timestamptz not null default now()
);

create index evaluation_requests_pending_idx on evaluation_requests(clinic_id) where status = 'pendente';

alter table evaluation_requests enable row level security;

create policy evaluation_requests_read on evaluation_requests for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor','recepcao'));

create trigger trg_audit_evaluation_requests after insert or update or delete on evaluation_requests
  for each row execute function fn_audit_log();

-- ── Dedup por CPF (criança e responsável) ──────────────────────────────────
alter table patients add column cpf text;
create unique index patients_clinic_cpf_unique on patients(clinic_id, cpf) where cpf is not null;

create unique index guardians_patient_cpf_unique on guardians(patient_id, cpf) where cpf is not null;

-- ── Rastreio de origem do documento + upload sem usuário logado ────────────
-- `profiles.id` referencia auth.users (on delete cascade) — não dá pra criar
-- um "profile de sistema" pro bot sem um auth.users correspondente (e criar
-- um usuário de autenticação só pra isso é mais frágil/arriscado do que
-- simplesmente permitir NULL aqui). `uploaded_by` vira nullable e uma CHECK
-- garante que só documento de origem 'whatsapp' pode vir sem uploader —
-- todo upload feito por humano logado (bucket clinic-documents via
-- app/recepcao/pacientes/[id]/documents-actions.ts) continua exigindo o id.
alter table documents add column source text not null default 'web' check (source in ('web','whatsapp'));
alter table documents alter column uploaded_by drop not null;
alter table documents add constraint documents_uploaded_by_or_bot
  check (uploaded_by is not null or source = 'whatsapp');
