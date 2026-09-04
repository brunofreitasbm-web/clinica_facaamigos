create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  full_name text not null,
  birth_date date not null,
  cid text,
  support_level text,
  status text not null default 'lead'
    check (status in ('lead','avaliacao','ativo','pausado','alta','evadido')),
  entry_source text,
  complaint text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  first_contact_at timestamptz,
  evaluated_at timestamptz,
  first_session_at timestamptz
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  profile_id uuid references profiles(id),
  full_name text not null,
  phone text not null,
  email text,
  cpf text,
  relationship text,
  is_financial boolean not null default false,
  portal_enabled boolean not null default false
);

create table patient_access (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  profile_id uuid not null references profiles(id),
  access_type text not null check (access_type in ('terapeuta','responsavel','supervisor')),
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table patients enable row level security;
alter table guardians enable row level security;
alter table patient_access enable row level security;

create function has_patient_access(p_patient_id uuid, p_types text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from patient_access pa
    where pa.patient_id = p_patient_id
      and pa.profile_id = auth.uid()
      and pa.access_type = any(p_types)
      and pa.revoked_at is null
  );
$$;

create policy patients_read on patients for select
  using (
    clinic_id = current_clinic_id() and (
      app_current_role() in ('gestor','supervisor','recepcao','faturamento')
      or has_patient_access(id, array['terapeuta','responsavel'])
    )
  );

create policy patients_write_recepcao_supervisor on patients for insert
  with check (clinic_id = current_clinic_id() and app_current_role() in ('recepcao','supervisor','gestor'));
create policy patients_update_recepcao_supervisor on patients for update
  using (clinic_id = current_clinic_id() and app_current_role() in ('recepcao','supervisor','gestor'));

create policy guardians_read on guardians for select
  using (
    exists (select 1 from patients pt where pt.id = guardians.patient_id and pt.clinic_id = current_clinic_id())
    and (app_current_role() in ('gestor','supervisor','recepcao') or profile_id = auth.uid())
  );
create policy guardians_write_recepcao on guardians for all
  using (app_current_role() in ('recepcao','supervisor','gestor'));

create policy patient_access_read on patient_access for select
  using (profile_id = auth.uid() or app_current_role() in ('gestor','supervisor'));
create policy patient_access_manage on patient_access for all
  using (app_current_role() in ('supervisor','gestor'));
