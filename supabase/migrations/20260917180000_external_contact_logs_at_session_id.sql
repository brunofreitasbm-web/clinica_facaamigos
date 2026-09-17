-- supabase/migrations/20260917180000_external_contact_logs_at_session_id.sql
-- 20260913040000_at_therapeutic_followup.sql documentou a intenção de ligar
-- a orientação de professores (external_contact_logs) à visita de AT em que
-- ela aconteceu, mas nunca chegou a criar a coluna — app/at/pacientes/
-- [patientId]/at-actions.ts (createTeacherOrientation) já grava
-- at_session_id, opcional (orientação também pode ser por telefone/e-mail
-- fora de uma sessão em campo).
alter table external_contact_logs
  add column at_session_id uuid references at_sessions(id) on delete set null;
