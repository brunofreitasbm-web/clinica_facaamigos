-- supabase/migrations/20260913020000_document_signatures.sql
-- Tabela para registro e trilha de auditoria de assinaturas eletrônicas de termos/laudos via OTP

create table if not exists document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  guardian_id uuid references guardians(id) on delete set null,
  signer_name text not null,
  signer_cpf text not null,
  signer_phone text not null,
  signer_ip text,
  otp_code_used text not null,
  document_hash text not null,
  signed_at timestamptz not null default now(),
  email_sent_to text,
  status text not null default 'assinado' check (status in ('pendente', 'assinado', 'recusado')),
  created_at timestamptz not null default now()
);

create index if not exists document_signatures_document_idx on document_signatures(document_id);
create index if not exists document_signatures_patient_idx on document_signatures(patient_id);
create index if not exists document_signatures_guardian_idx on document_signatures(guardian_id);

alter table document_signatures enable row level security;

-- Policies de Leitura:
-- 1. Roles administrativas (recepcao, supervisor, gestor, faturamento) leem tudo da clínica
-- 2. Responsáveis leem assinaturas dos seus pacientes vinculados
create policy document_signatures_select on document_signatures for select
  using (
    (app_current_role() in ('recepcao','supervisor','gestor','faturamento') and
     exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id()))
    or (has_patient_access(patient_id, array['responsavel']) and
        exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id()))
  );

-- Service Role (usado nas Server Actions com admin client) possui privilégio total.
