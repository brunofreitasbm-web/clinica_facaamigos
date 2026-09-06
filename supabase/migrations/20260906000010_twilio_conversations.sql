-- supabase/migrations/20260906000010_twilio_conversations.sql
-- Central Multicanal de Atendimento (Menu Gestão): agrupa as mensagens do
-- WhatsApp já registradas em `messages` em threads por telefone, com
-- alternância bot/humano e respostas rápidas cadastráveis.

create table twilio_conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  guardian_id uuid references guardians(id),
  phone_number text not null,
  conversation_sid text,
  is_bot_active boolean not null default true,
  status text not null default 'open' check (status in ('open','closed')),
  assigned_to uuid references profiles(id),
  unread_count int not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create index twilio_conversations_phone_idx on twilio_conversations (phone_number);
create index twilio_conversations_patient_idx on twilio_conversations (patient_id);

-- Reaproveita a tabela `messages` já existente (audit_and_messages) em vez de
-- criar uma tabela `twilio_messages` paralela — evita duas fontes de verdade
-- para o mesmo histórico de conversa.
alter table messages add column conversation_id uuid references twilio_conversations(id);
alter table messages add column sender_type text not null default 'user' check (sender_type in ('user','bot','agent'));
alter table messages add column media_url text;
alter table messages add column delivery_status text;
alter table messages add column twilio_sid text;

create index messages_conversation_id_idx on messages (conversation_id);

create table quick_responses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  shortcut text not null,
  title text not null,
  content_text text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, shortcut)
);

alter table twilio_conversations enable row level security;
alter table quick_responses enable row level security;

-- Conversas e o toggle bot/humano são operação de atendimento (recepção,
-- supervisão e gestão), mesmo conjunto de papéis que já escreve em `messages`.
create policy twilio_conversations_read on twilio_conversations for select
  using (
    exists (select 1 from patients pt where pt.id = twilio_conversations.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy twilio_conversations_write on twilio_conversations for insert
  with check (
    exists (select 1 from patients pt where pt.id = twilio_conversations.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy twilio_conversations_update on twilio_conversations for update
  using (
    exists (select 1 from patients pt where pt.id = twilio_conversations.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy quick_responses_read on quick_responses for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor','recepcao'));

create policy quick_responses_manage on quick_responses for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor'));
