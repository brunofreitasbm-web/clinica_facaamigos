-- supabase/migrations/20260917170300_receipts.sql
-- "O recibo é gerado toda vez que houver pagamento" (Diretriz de Atendimento
-- Particular) — recibo numerado sequencialmente por clínica/ano, PDF salvo
-- em `documents` (categoria nova 'recibo') e enviado por WhatsApp ao
-- responsável financeiro (lib/receipts.ts).
alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check check (category in
  ('pedido_medico','laudo','carteirinha','termo','relatorio_evolucao','reavaliacao','autorizacao','relatorio_at_escola','recibo','outro'));

create table receipt_counters (
  clinic_id uuid not null references clinics(id),
  year int not null,
  last_number int not null default 0,
  primary key (clinic_id, year)
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  year int not null default extract(year from now() at time zone 'America/Sao_Paulo')::int,
  number int not null default 0,
  patient_id uuid not null references patients(id),
  payer_name text not null,
  payer_document text,
  source_type text not null check (source_type in ('contract_invoice','patient_charge')),
  source_id uuid not null,
  description text not null,
  amount numeric(10,2) not null,
  paid_at timestamptz not null,
  document_id uuid references documents(id),
  sent_whatsapp_at timestamptz,
  send_error text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, year, number),
  unique (source_type, source_id)
);

-- Numeração sequencial por clínica/ano — mesmo padrão de assign_checkin_ticket
-- (20260908040000): default 0 no insert sinaliza "ainda não numerado".
create function assign_receipt_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_number int;
begin
  insert into receipt_counters (clinic_id, year, last_number)
  values (new.clinic_id, new.year, 1)
  on conflict (clinic_id, year)
    do update set last_number = receipt_counters.last_number + 1
  returning last_number into v_number;

  new.number := v_number;
  return new;
end;
$$;

create trigger trg_assign_receipt_number
  before insert on receipts
  for each row execute function assign_receipt_number();

alter table receipts enable row level security;

create policy receipts_read on receipts for select
  using (
    exists (select 1 from patients pt where pt.id = receipts.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao','faturamento')
      or has_patient_access(receipts.patient_id, array['responsavel'])
    )
  );

create policy receipts_write on receipts for insert
  with check (
    exists (select 1 from patients pt where pt.id = receipts.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','recepcao','faturamento')
  );

create policy receipts_update on receipts for update
  using (
    exists (select 1 from patients pt where pt.id = receipts.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','recepcao','faturamento')
  );

-- Template do WhatsApp de recibo (lib/receipts.ts::sendReceiptWhatsApp),
-- mesmo padrão de seed de message_templates (20260908080000). category
-- 'cobranca' é a mais próxima do check existente (financeiro/pagamento).
insert into message_templates (clinic_id, category, name, channel, body)
select c.id, 'cobranca', 'Recibo de pagamento', 'whatsapp',
  'Olá! Segue o recibo do pagamento de {{descricao}} no valor de {{valor}}. Guarde para eventual reembolso junto ao seu plano de saúde. 💙'
from clinics c
where not exists (
  select 1 from message_templates mt where mt.clinic_id = c.id and mt.name = 'Recibo de pagamento'
);

alter table audit_log drop constraint audit_log_action_check;
alter table audit_log add constraint audit_log_action_check
check (action = ANY (ARRAY[
  'INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'download'::text,
  'draft_validated'::text, 'draft_rejected'::text, 'draft_extracted'::text,
  'intake_batch_uploaded'::text, 'intake_batch_extracted'::text,
  'intake_lead_approved'::text, 'intake_contact_sent'::text,
  'intake_docs_approved'::text, 'intake_docs_rejected'::text,
  'intake_lead_scheduled'::text, 'intake_lead_cancelled'::text,
  'grupoib_sync_access_email_sent'::text, 'grupoib_sync_access_email_failed'::text,
  'grupoib_sync_role_pending_review'::text,
  'staff_password_reset'::text, 'staff_signature_pin_reset'::text,
  'google_calendar_event_created'::text, 'google_calendar_event_updated'::text,
  'google_calendar_event_cancelled'::text, 'google_calendar_sync_failed'::text,
  'google_calendar_token_refresh_failed'::text,
  'receipt_generated'::text, 'receipt_sent'::text,
  'patient_auto_discharged'::text, 'patient_reactivated'::text,
  'acolhimento_status_changed'::text
]));
