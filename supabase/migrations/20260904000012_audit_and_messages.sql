-- supabase/migrations/20260904000012_audit_and_messages.sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  guardian_id uuid references guardians(id),
  channel text not null check (channel in ('whatsapp','portal')),
  direction text not null check (direction in ('outbound','inbound')),
  template_key text,
  body text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  related_appointment_id uuid references appointments(id)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  clinic_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create table record_access_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  accessed_by uuid not null references profiles(id),
  accessed_at timestamptz not null default now(),
  reason text
);

alter table messages enable row level security;
alter table audit_log enable row level security;
alter table record_access_log enable row level security;

create function fn_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, row_id, action, actor_id, clinic_id, before, after)
  values (
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    TG_OP,
    auth.uid(),
    current_clinic_id(),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_patients after insert or update or delete on patients
  for each row execute function fn_audit_log();
create trigger trg_audit_appointments after insert or update or delete on appointments
  for each row execute function fn_audit_log();
create trigger trg_audit_session_notes after insert on session_notes
  for each row execute function fn_audit_log();
create trigger trg_audit_authorizations after insert or update or delete on authorizations
  for each row execute function fn_audit_log();
create trigger trg_audit_billing_items after insert or update or delete on billing_items
  for each row execute function fn_audit_log();
create trigger trg_audit_glosas after insert or update or delete on glosas
  for each row execute function fn_audit_log();
create trigger trg_audit_payouts after insert or update or delete on payouts
  for each row execute function fn_audit_log();
create trigger trg_audit_treatment_plans after insert or update or delete on treatment_plans
  for each row execute function fn_audit_log();
create trigger trg_audit_plan_goals after insert or update or delete on plan_goals
  for each row execute function fn_audit_log();

create policy messages_read on messages for select
  using (
    app_current_role() in ('gestor','supervisor','recepcao')
    or has_patient_access(patient_id, array['responsavel','terapeuta'])
  );
create policy messages_write on messages for insert
  with check (app_current_role() in ('recepcao','supervisor','gestor') or has_patient_access(patient_id, array['responsavel']));

-- audit_log tem apenas colunas genéricas (table_name/row_id, sem clinic_id/patient_id
-- diretos possíveis para join, já que row_id aponta para tabelas distintas conforme
-- table_name). Para evitar vazamento entre clínicas (um gestor lendo audit_log de
-- outra clínica), fn_audit_log() agora grava clinic_id = current_clinic_id() do ator
-- no momento do evento, e a policy de leitura usa essa coluna.
create policy audit_log_read on audit_log for select
  using (app_current_role() = 'gestor' and clinic_id = current_clinic_id());

create policy record_access_log_read on record_access_log for select
  using (
    exists (
      select 1 from patients p
      where p.id = record_access_log.patient_id
        and p.clinic_id = current_clinic_id()
    )
    and app_current_role() in ('gestor','supervisor')
  );
create policy record_access_log_write on record_access_log for insert
  with check (accessed_by = auth.uid());
