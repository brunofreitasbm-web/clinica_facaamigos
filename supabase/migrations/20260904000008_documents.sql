-- supabase/migrations/20260904000008_documents.sql
-- Tabela de documentos/anexos com categoria fixa e flag de portal da família.
-- RLS policies:
--   - Responsáveis: leem apenas se shared_with_family=true
--   - Terapeutas: leem/escrevem apenas documentos do seu paciente
--   - Recepção/Supervisor/Gestor/Faturamento: leem/escrevem tudo da sua clínica
-- FIXED: policies verificam clinic_id via join em patients.

create table documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  category text not null check (category in
    ('pedido_medico','laudo','carteirinha','termo','relatorio_evolucao','reavaliacao','autorizacao','outro')),
  storage_path text not null,
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz not null default now(),
  valid_until date,
  shared_with_family boolean not null default false
);

alter table documents enable row level security;

create policy documents_read on documents for select
  using (
    -- Roles genéricas (gestor, supervisor, recepção, faturamento) veem tudo da sua clínica
    (app_current_role() in ('gestor','supervisor','recepcao','faturamento') and
     exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id()))
    -- Terapeutas veem documentos do seu paciente vinculado
    or (has_patient_access(patient_id, array['terapeuta']) and
        exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id()))
    -- Responsáveis veem apenas se shared_with_family=true
    or (has_patient_access(patient_id, array['responsavel']) and
        shared_with_family = true and
        exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id()))
  );

create policy documents_write on documents for insert
  with check (
    -- Roles genéricas inserem tudo da sua clínica
    (app_current_role() in ('recepcao','supervisor','gestor') and
     exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id()))
    -- Terapeutas inserem apenas para seu paciente vinculado
    or (has_patient_access(patient_id, array['terapeuta']) and
        exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id()))
  );
