-- supabase/migrations/20260904000007b_session_notes_therapist_fix.sql
-- FIX: session_notes_insert permitia que qualquer terapeuta da clínica inserisse notas
-- em appointments que não eram suas. Violava PRD §3.3 "tudo tem autor".
-- Correção: apenas o appointment.therapist_id pode inserir notas (match com trial_data_insert).
-- Supervisors removidos — "tudo tem autor" exige identidade verdadeira, não impersonation.

drop policy session_notes_insert on session_notes;

create policy session_notes_insert on session_notes for insert
  with check (
    exists (select 1 from appointments a
           join patients p on p.id = a.patient_id
           where a.id = appointment_id
           and a.therapist_id = auth.uid()
           and p.clinic_id = current_clinic_id())
  );
