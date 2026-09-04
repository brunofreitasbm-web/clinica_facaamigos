-- supabase/migrations/20260904000018_patient_header.sql
-- Item 1 do PRD "11 incrementos": header de identificação rápida do
-- paciente (nome, convênio ativo, carteirinha, contato de emergência).
-- Convênio/carteirinha já existem em patient_insurance/insurers — só falta
-- marcar qual responsável (guardians) é o contato de emergência.

alter table guardians add column is_emergency_contact boolean not null default false;

-- Garante no máximo um contato de emergência marcado por paciente, sem
-- impedir zero (paciente pode ainda não ter nenhum cadastrado).
create unique index guardians_one_emergency_contact_per_patient
  on guardians (patient_id)
  where is_emergency_contact;
