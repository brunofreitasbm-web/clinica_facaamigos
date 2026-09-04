create table insurers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  ans_code text,
  billing_rules jsonb not null default '{}'::jsonb
);

create table insurer_price_tables (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id),
  procedure_code text not null,
  procedure_name text not null,
  price numeric(10,2) not null,
  valid_from date not null,
  valid_to date,
  exclude using gist (
    insurer_id with =,
    procedure_code with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create table patient_insurance (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  insurer_id uuid references insurers(id),
  card_number text,
  card_valid_until date,
  plan_name text,
  is_private boolean not null default false
);

create table authorizations (
  id uuid primary key default gen_random_uuid(),
  patient_insurance_id uuid not null references patient_insurance(id),
  guide_number text,
  procedure_code text not null,
  sessions_authorized int not null,
  sessions_used int not null default 0,
  valid_from date not null,
  valid_to date not null,
  status text not null default 'pendente'
    check (status in ('pendente','ativa','esgotada','vencida','negada')),
  requested_at timestamptz,
  approved_at timestamptz,
  document_id uuid,
  previous_authorization_id uuid references authorizations(id),
  check (sessions_used <= sessions_authorized)
);

alter table insurers enable row level security;
alter table insurer_price_tables enable row level security;
alter table patient_insurance enable row level security;
alter table authorizations enable row level security;

create policy insurers_read on insurers for select
  using (clinic_id = current_clinic_id());
create policy insurers_manage_gestor on insurers for all
  using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy price_tables_read on insurer_price_tables for select
  using (exists (select 1 from insurers i where i.id = insurer_price_tables.insurer_id and i.clinic_id = current_clinic_id())
         and app_current_role() in ('gestor','faturamento'));
create policy price_tables_manage_gestor on insurer_price_tables for all
  using (app_current_role() = 'gestor');

create policy patient_insurance_read on patient_insurance for select
  using (
    exists (select 1 from patients pt where pt.id = patient_insurance.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao','faturamento')
  );
create policy patient_insurance_write on patient_insurance for all
  using (
    exists (select 1 from patients pt where pt.id = patient_insurance.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('recepcao','supervisor','gestor')
  );

create policy authorizations_read on authorizations for select
  using (
    exists (
      select 1 from patient_insurance pi join patients pt on pt.id = pi.patient_id
      where pi.id = authorizations.patient_insurance_id and pt.clinic_id = current_clinic_id()
    )
    and app_current_role() in ('gestor','supervisor','recepcao','faturamento')
  );
create policy authorizations_write on authorizations for all
  using (
    exists (
      select 1 from patient_insurance pi join patients pt on pt.id = pi.patient_id
      where pi.id = authorizations.patient_insurance_id and pt.clinic_id = current_clinic_id()
    )
    and app_current_role() in ('recepcao','supervisor','gestor')
  );
