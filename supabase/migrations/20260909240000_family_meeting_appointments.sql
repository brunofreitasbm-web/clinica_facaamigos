-- supabase/migrations/20260909240000_family_meeting_appointments.sql
--
-- Reunião com o responsável de um paciente já ATIVO na clínica (chamado
-- aberto pelo portal da família ou WhatsApp) — distinta de `is_evaluation`
-- (1ª avaliação de lead novo, que ainda não tem cadastro/tratamento em
-- andamento e por isso dispara efeitos de intake: billing pulado, paciente
-- só vira 'ativo' quando NÃO é avaliação, etc. — ver
-- 20260906000018_auto_billing_item_on_session_close.sql e
-- 20260906000026_bind_patient_lifecycle_triggers_and_fix_evaluation_skip.sql).
-- Reaproveita a mesma agenda/grade de 1ª avaliação
-- (lib/evaluation-agenda.ts::getEvaluationCalendarAppointments) só pra
-- exibição — daí uma coluna aditiva própria em vez de sobrecarregar
-- is_evaluation.
alter table appointments add column is_family_meeting boolean not null default false;

alter table appointments add constraint appointments_evaluation_meeting_exclusive
  check (not (is_evaluation and is_family_meeting));
