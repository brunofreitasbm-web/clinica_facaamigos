create table appointment_types (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  modality text not null default 'presencial' check (modality in ('presencial', 'remoto')),
  duration_minutes int not null check (duration_minutes > 0),
  display_interval_minutes int not null check (display_interval_minutes > 0),
  recurrence text not null default 'semanal' check (recurrence in ('unica', 'semanal', 'quinzenal', 'mensal')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name)
);

alter table appointment_types enable row level security;

create policy appointment_types_read on appointment_types for select
  using (clinic_id = current_clinic_id());
create policy appointment_types_manage_gestor on appointment_types for all
  using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');
