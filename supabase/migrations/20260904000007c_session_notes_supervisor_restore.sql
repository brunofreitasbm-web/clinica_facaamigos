-- supabase/migrations/20260904000007c_session_notes_supervisor_restore.sql
-- FIX Round 2: Restaura permissão de supervisor inserir session_notes, mas com identidade honesta.
-- O problema real não era "supervisor pode inserir" (previsto no plano original Task 7),
-- mas sim a falta de amarração therapist_id = auth.uid() (sem impersonation).
--
-- Nova regra: therapist_id SEMPRE = auth.uid() (autor = pessoa real que inseriu)
--   - Terapeuta dono: insere na própria appointment com therapist_id = próprio uid
--   - Supervisor: insere em qualquer appointment da clínica com therapist_id = próprio uid
-- Isso preserva "tudo tem autor" (PRD §3.3) sem eliminar capacidade prevista no plano.

drop policy session_notes_insert on session_notes;

create policy session_notes_insert on session_notes for insert
  with check (
    therapist_id = auth.uid()
    and (
      exists (select 1 from appointments a
             join patients p on p.id = a.patient_id
             where a.id = session_notes.appointment_id
             and a.therapist_id = auth.uid()
             and p.clinic_id = current_clinic_id())
      or (app_current_role() = 'supervisor'
          and exists (select 1 from appointments a
                     join patients p on p.id = a.patient_id
                     where a.id = session_notes.appointment_id
                     and p.clinic_id = current_clinic_id()))
    )
  );
