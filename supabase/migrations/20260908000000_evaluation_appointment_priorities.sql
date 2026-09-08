-- Catálogo de prioridades de agendamentos de 1ª avaliação de planos de saúde
-- Permite que o gestor configure diferentes níveis de prioridade para agendar
-- avaliações iniciais conforme as políticas de cada convênio

create table if not exists evaluation_appointment_priorities (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  insurance_id uuid not null,
  priority_level int not null,
  label text not null,
  description text,
  color text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_by uuid,

  constraint valid_priority_level check (priority_level > 0 and priority_level <= 10),
  foreign key (clinic_id) references clinics(id) on delete cascade,
  foreign key (insurance_id) references insurers(id) on delete cascade,
  foreign key (created_by) references auth.users(id) on delete set null,
  foreign key (updated_by) references auth.users(id) on delete set null
);

create index if not exists idx_eval_priorities_clinic on evaluation_appointment_priorities(clinic_id);
create index if not exists idx_eval_priorities_insurance on evaluation_appointment_priorities(insurance_id);
create unique index if not exists idx_eval_priorities_unique_level on evaluation_appointment_priorities(clinic_id, insurance_id, priority_level) where active;

-- RLS Policy: supervisores e gestores podem gerenciar
alter table evaluation_appointment_priorities enable row level security;

create policy "evaluation_priorities_select"
  on evaluation_appointment_priorities for select
  using (clinic_id in (select clinic_id from user_clinic_access));

create policy "evaluation_priorities_insert_update_delete"
  on evaluation_appointment_priorities for insert, update, delete
  using (
    clinic_id in (
      select clinic_id from user_clinic_access
      where role in ('admin', 'supervisor', 'gestor')
    )
  );
