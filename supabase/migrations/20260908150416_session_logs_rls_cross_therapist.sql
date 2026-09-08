-- supabase/migrations/20260908150416_session_logs_rls_cross_therapist.sql
--
-- Corrige "new row violates row-level security policy" ao registrar
-- intervenções (e eventos ABC) durante a sessão.
--
-- Causa raiz: as políticas de INSERT de session_intervention_logs e
-- aba_abc_logs exigiam `appointments.therapist_id = auth.uid()`, ou seja,
-- só o terapeuta titular do agendamento conseguia gravar. Qualquer
-- terapeuta cobrindo a sessão de um colega (cenário normal da clínica)
-- batia no RLS. session_notes já havia sido corrigida em
-- 20260907180000_open_session_note_signing.sql — aqui alinhamos o resto
-- do registro de sessão ao mesmo padrão: vale o vínculo com a clínica +
-- papel clínico, não a titularidade do agendamento.
--
-- Substitui 20260908090000_session_intervention_logs_rls_fix.sql, que
-- nunca chegou a ser aplicado no projeto remoto.

-- ---------------------------------------------------------------------
-- session_intervention_logs
-- ---------------------------------------------------------------------
drop policy if exists session_intervention_logs_insert on session_intervention_logs;
create policy session_intervention_logs_insert on session_intervention_logs for insert to authenticated
  with check (
    therapist_id = (select auth.uid())
    and (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_intervention_logs.appointment_id
        -- amarra patient_id ao agendamento: o cliente manda os dois e não
        -- pode desassociá-los para gravar em prontuário de outro paciente
        and a.patient_id = session_intervention_logs.patient_id
        and p.clinic_id = (select current_clinic_id())
    )
  );

drop policy if exists session_intervention_logs_read on session_intervention_logs;
create policy session_intervention_logs_read on session_intervention_logs for select to authenticated
  using (
    exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_intervention_logs.appointment_id
        and p.clinic_id = (select current_clinic_id())
        and (
          (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
          or a.therapist_id = (select auth.uid())
          or (select has_patient_access(a.patient_id, array['terapeuta']))
        )
    )
  );

-- ---------------------------------------------------------------------
-- aba_abc_logs (mesmo bug, mesma tela de sessão)
-- ---------------------------------------------------------------------
drop policy if exists aba_abc_logs_insert on aba_abc_logs;
create policy aba_abc_logs_insert on aba_abc_logs for insert to authenticated
  with check (
    therapist_id = (select auth.uid())
    and (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = aba_abc_logs.appointment_id
        and a.patient_id = aba_abc_logs.patient_id
        and p.clinic_id = (select current_clinic_id())
    )
  );
