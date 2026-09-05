-- supabase/migrations/20260904000030_aba_clinical_module.sql

-- 1. Tabela de Registros Funcionais ABC (Antecedente, Comportamento, Consequência)
create table if not exists aba_abc_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  therapist_id uuid not null references profiles(id),
  antecedent text not null,
  behavior_description text not null,
  consequence text not null,
  intensity text check (intensity in ('leve', 'moderada', 'grave')),
  duration_seconds numeric(6,2),
  recorded_at timestamptz not null default now()
);

alter table aba_abc_logs enable row level security;

-- Policies para aba_abc_logs
create policy aba_abc_logs_read on aba_abc_logs for select
  using (
    exists (
      select 1 from patients p
      where p.id = aba_abc_logs.patient_id
      and p.clinic_id = current_clinic_id()
    )
    and (
      app_current_role() in ('gestor', 'supervisor')
      or therapist_id = auth.uid()
      or has_patient_access(patient_id, array['terapeuta'])
    )
  );

create policy aba_abc_logs_insert on aba_abc_logs for insert
  with check (
    therapist_id = auth.uid()
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = appointment_id
      and p.clinic_id = current_clinic_id()
      and a.therapist_id = auth.uid()
    )
  );

-- Índices para performance em consultas clínicas
create index if not exists idx_aba_abc_logs_appointment on aba_abc_logs(appointment_id);
create index if not exists idx_aba_abc_logs_patient on aba_abc_logs(patient_id, recorded_at desc);
create index if not exists idx_trial_data_appointment on trial_data(appointment_id);
create index if not exists idx_trial_data_program on trial_data(program_id, recorded_at desc);
