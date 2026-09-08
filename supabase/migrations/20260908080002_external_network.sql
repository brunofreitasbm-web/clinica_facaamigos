-- Onda 3, módulo Rede Externa (escola, médicos, outros profissionais).
-- Reaproveita has_patient_access() (já usado em treatment_plans/protocols)
-- pra dar ao terapeuta do paciente o mesmo acesso de gestor/supervisor,
-- e documents.id como referência opcional de relatório compartilhado.

create table external_contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  kind text not null check (kind in ('escola', 'medico', 'outro_profissional')),
  name text not null,
  role_title text,
  phone text,
  email text,
  notes text,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table external_contact_logs (
  id uuid primary key default gen_random_uuid(),
  external_contact_id uuid not null references external_contacts(id) on delete cascade,
  contacted_by uuid not null references profiles(id) on delete restrict,
  contacted_at timestamptz not null default now(),
  channel text not null check (channel in ('telefone', 'email', 'reuniao', 'relatorio_compartilhado', 'outro')),
  summary text not null,
  document_id uuid references documents(id) on delete set null
);

create index external_contacts_patient_idx on external_contacts (patient_id);
create index external_contact_logs_contact_idx on external_contact_logs (external_contact_id);

alter table external_contacts enable row level security;
alter table external_contact_logs enable row level security;

create policy external_contacts_read on external_contacts
  for select using (
    clinic_id = current_clinic_id()
    and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(patient_id, array['terapeuta']))
  );

create policy external_contacts_write on external_contacts
  for insert with check (
    clinic_id = current_clinic_id()
    and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(patient_id, array['terapeuta']))
    and created_by = auth.uid()
  );

create policy external_contacts_update on external_contacts
  for update using (
    clinic_id = current_clinic_id()
    and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(patient_id, array['terapeuta']))
  );

create policy external_contacts_delete on external_contacts
  for delete using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

create policy external_contact_logs_read on external_contact_logs
  for select using (
    external_contact_id in (
      select id from external_contacts ec
      where ec.clinic_id = current_clinic_id()
        and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(ec.patient_id, array['terapeuta']))
    )
  );

create policy external_contact_logs_write on external_contact_logs
  for insert with check (
    contacted_by = auth.uid()
    and external_contact_id in (
      select id from external_contacts ec
      where ec.clinic_id = current_clinic_id()
        and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(ec.patient_id, array['terapeuta']))
    )
  );
