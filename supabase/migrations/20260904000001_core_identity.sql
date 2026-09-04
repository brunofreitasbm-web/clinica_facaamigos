create extension if not exists pgtap;
create extension if not exists btree_gist;

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  role text not null check (role in ('gestor','supervisor','terapeuta','recepcao','faturamento','responsavel')),
  full_name text not null,
  council_type text,
  council_number text,
  phone text,
  active boolean not null default true,
  esdm_certified boolean not null default false,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  capacity int not null default 1
);

create table therapist_contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  tier text not null,
  hourly_rate numeric(10,2) not null,
  valid_from date not null,
  valid_to date,
  exclude using gist (
    profile_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

alter table clinics enable row level security;
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table therapist_contracts enable row level security;

create function current_clinic_id() returns uuid
language sql stable security definer set search_path = public as $$
  select clinic_id from profiles where id = auth.uid();
$$;

create function app_current_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create policy clinics_read on clinics for select
  using (id = current_clinic_id());

create policy profiles_read_same_clinic on profiles for select
  using (clinic_id = current_clinic_id());

create policy profiles_self_update on profiles for update
  using (id = auth.uid());

create policy rooms_read on rooms for select
  using (clinic_id = current_clinic_id());

create policy rooms_manage_by_supervisor_gestor on rooms for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor'));

create policy therapist_contracts_read_own_or_admin on therapist_contracts for select
  using (
    profile_id = auth.uid()
    or exists (select 1 from profiles p where p.id = therapist_contracts.profile_id
               and p.clinic_id = current_clinic_id() and app_current_role() = 'gestor')
  );

create policy therapist_contracts_manage_by_gestor on therapist_contracts for insert
  with check (app_current_role() = 'gestor');
create policy therapist_contracts_manage_by_gestor_upd on therapist_contracts for update
  using (app_current_role() = 'gestor');
