-- Devolutiva do paciente para com os pais — reunião marcada pela Supervisão
-- (sob demanda do supervisor, não parte do fluxo automático de 1ª avaliação)
-- na sala de avaliação. Mesma convenção aditiva de
-- 20260909240000_family_meeting_appointments.sql: reaproveita a agenda/sala
-- de 1ª avaliação só pra exibição, por isso uma coluna própria em vez de
-- sobrecarregar is_evaluation/is_family_meeting.
alter table appointments add column is_patient_feedback boolean not null default false;

alter table appointments add constraint appointments_evaluation_feedback_exclusive
  check (not (is_evaluation and is_patient_feedback));

alter table appointments add constraint appointments_meeting_feedback_exclusive
  check (not (is_family_meeting and is_patient_feedback));
