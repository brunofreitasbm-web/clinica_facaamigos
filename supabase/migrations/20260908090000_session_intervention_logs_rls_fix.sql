-- supabase/migrations/20260908090000_session_intervention_logs_rls_fix.sql
--
-- Alinha as políticas RLS de session_intervention_logs com o padrão de session_notes
-- (20260907180000_open_session_note_signing.sql).
--
-- Problema: A política anterior de INSERT (session_intervention_logs_insert)
-- exigia `appointments.therapist_id = auth.uid()`, o que bloqueava terapeutas
-- cobrindo a sessão de colegas de registrar intervenções.

drop policy if exists session_intervention_logs_insert on session_intervention_logs;
create policy session_intervention_logs_insert on session_intervention_logs for insert
  with check (
    therapist_id = (select auth.uid())
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_intervention_logs.appointment_id
        and a.patient_id = session_intervention_logs.patient_id
        and p.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
  );

drop policy if exists session_intervention_logs_read on session_intervention_logs;
create policy session_intervention_logs_read on session_intervention_logs for select
  using (
    exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_intervention_logs.appointment_id
        and a.patient_id = session_intervention_logs.patient_id
        and p.clinic_id = (select current_clinic_id())
        and (
          (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
          or a.therapist_id = (select auth.uid())
          or (select has_patient_access(a.patient_id, array['terapeuta']))
        )
    )
  );
