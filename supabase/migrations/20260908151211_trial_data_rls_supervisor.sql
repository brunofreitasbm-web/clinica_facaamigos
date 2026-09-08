-- Libera o supervisor para registrar tentativas ABA durante a sessão.
--
-- Causa: trial_data_insert exigia `app_current_role() = 'terapeuta'`
-- (papel exato), então o supervisor que assume/cobre uma sessão batia em
-- "new row violates row-level security policy". Ele já podia criar a
-- evolução (session_notes_insert aceita terapeuta+supervisor) e, desde
-- 20260908150416, registrar intervenções e eventos ABC — trial_data era o
-- último ponto do registro de sessão fora do padrão.
--
-- Aproveita para fechar um furo de integridade: a política antiga não
-- verificava que o `program_id` pertencia ao paciente do agendamento, ou
-- seja, dava para gravar tentativas de um programa de outro paciente da
-- mesma clínica. Agora a cadeia program -> plan_goal -> treatment_plan ->
-- patient tem que bater com o paciente do appointment.
--
-- trial_data não tem coluna therapist_id (é insert-only, sem update/delete
-- no app), por isso a política se apoia em clínica + papel + vínculo do
-- programa, sem amarrar a auth.uid().

drop policy if exists trial_data_insert on trial_data;
create policy trial_data_insert on trial_data for insert to authenticated
  with check (
    (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
    and exists (
      select 1
      from appointments a
      join patients p on p.id = a.patient_id
      join programs prog on prog.id = trial_data.program_id
      join plan_goals pg on pg.id = prog.plan_goal_id
      join treatment_plans tp on tp.id = pg.treatment_plan_id
      where a.id = trial_data.appointment_id
        and p.clinic_id = (select current_clinic_id())
        and tp.patient_id = a.patient_id
    )
  );
