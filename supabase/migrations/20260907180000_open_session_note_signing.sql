-- Antes, só o terapeuta dono do agendamento (appointments.therapist_id)
-- podia ler o agendamento pra assinar, inserir a evolução (session_notes)
-- ou registrar tentativas (trial_data). Isso quebrava o caso legítimo de
-- um terapeuta cobrir/assinar a sessão de um colega da mesma clínica.
-- Decisão: qualquer perfil 'terapeuta' da clínica pode assinar/editar a
-- evolução e registrar coleta de qualquer sessão, não só a sua. A
-- ownership original (therapist_id) continua registrada no agendamento
-- e session_notes.therapist_id sempre grava quem de fato assinou.

drop policy appointments_read on appointments;
create policy appointments_read on appointments for select
  using (
    exists (
      select 1 from patients pt
      where pt.id = appointments.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (
      (select app_current_role()) = any (array['gestor','supervisor','recepcao','faturamento','terapeuta'])
      or therapist_id = (select auth.uid())
      or (select has_patient_access(patient_id, array['terapeuta','responsavel']))
    )
  );

drop policy session_notes_read on session_notes;
create policy session_notes_read on session_notes for select
  using (
    exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_notes.appointment_id
        and p.clinic_id = (select current_clinic_id())
        and (
          (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
          or a.therapist_id = (select auth.uid())
          or (select has_patient_access(a.patient_id, array['terapeuta']))
        )
    )
  );

drop policy session_notes_insert on session_notes;
create policy session_notes_insert on session_notes for insert
  with check (
    therapist_id = (select auth.uid())
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_notes.appointment_id
        and p.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) = any (array['terapeuta','supervisor'])
  );

drop policy trial_data_read on trial_data;
create policy trial_data_read on trial_data for select
  using (
    exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = trial_data.appointment_id
        and p.clinic_id = (select current_clinic_id())
        and (
          (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
          or a.therapist_id = (select auth.uid())
          or (select has_patient_access(a.patient_id, array['terapeuta']))
        )
    )
  );

drop policy trial_data_insert on trial_data;
create policy trial_data_insert on trial_data for insert
  with check (
    exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = trial_data.appointment_id
        and p.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) = 'terapeuta'
  );
