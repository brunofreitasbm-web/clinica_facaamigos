-- Onda 2, módulo Lista de Espera e Gestão de Capacidade. Distinto do funil
-- de acolhimento (insurance_intake_leads/registration_drafts — pré-1ª
-- avaliação): aqui entram pacientes já em avaliação/ativos que precisam de
-- uma especialidade/terapeuta sem vaga disponível na grade agora. Prioridade
-- é um campo manual (não um algoritmo automático) — quem decide a ordem é a
-- supervisão, o campo só torna essa decisão visível e ordenável.

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  specialty_value text not null,
  insurer_id uuid references insurers(id) on delete set null,
  preferred_shift text not null default 'qualquer' check (preferred_shift in ('manha', 'tarde', 'noite', 'qualquer')),
  priority smallint not null default 0,
  status text not null default 'aguardando' check (status in ('aguardando', 'oferecido', 'agendado', 'desistiu', 'cancelado')),
  notes text,
  offered_at timestamptz,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index waitlist_entries_clinic_status_idx on waitlist_entries (clinic_id, status, priority desc);

alter table waitlist_entries enable row level security;

create policy waitlist_entries_read on waitlist_entries
  for select using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor', 'recepcao'));

create policy waitlist_entries_write on waitlist_entries
  for insert with check (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

create policy waitlist_entries_update on waitlist_entries
  for update using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

create policy waitlist_entries_delete on waitlist_entries
  for delete using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));
