-- supabase/migrations/20261114120000_non_patient_contacts.sql
-- "Não é paciente": telefone do WhatsApp que a recepção marcou à mão como
-- dúvida avulsa, publicidade, fornecedor etc. O contato sai de Autorizações,
-- Pendências e do painel de leads (o rascunho aberto é arquivado com motivo) e
-- o robô para de abrir rascunho novo para esse número. O chat continua normal
-- até alguém encerrar a conversa. Desmarcar apaga a linha.
--
-- Uma linha por (clínica, telefone). O telefone fica no mesmo formato E.164 de
-- registration_drafts.source_phone / twilio_conversations.phone_number.
create table if not exists non_patient_contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  phone text not null,
  reason text not null,
  marked_by uuid references profiles(id),
  marked_at timestamptz not null default now(),
  -- Paciente "interessado" (sem prontuário) que a marcação arquivou; usado para desfazer.
  archived_patient_id uuid references patients(id),
  unique (clinic_id, phone)
);

alter table non_patient_contacts enable row level security;

create policy non_patient_contacts_staff on non_patient_contacts for all
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));
