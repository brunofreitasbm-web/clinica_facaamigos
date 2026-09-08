-- Corrige "Não foi possível salvar a evolução" para o papel 'gestor'.
--
-- Causa raiz: app/terapeuta/evolucao/actions.ts::createSessionNote já
-- aceita terapeuta/supervisor/gestor como signerProfile.role (mesmo texto
-- de erro genérico em qualquer falha de INSERT, então o 403 de RLS vira
-- "Não foi possível salvar a evolução. Tente de novo." sem detalhe), mas a
-- policy session_notes_insert (20260907180000_open_session_note_signing.sql)
-- só liberava app_current_role() = any (array['terapeuta','supervisor']) —
-- 'gestor' batia em "new row violates row-level security policy for table
-- session_notes" (confirmado nos postgres_logs, POST 403 em
-- /rest/v1/session_notes para um profile com role='gestor' cobrindo uma
-- sessão de outro terapeuta).
--
-- Mesmo padrão já aplicado a session_intervention_logs e aba_abc_logs
-- (20260908150416_session_logs_rls_cross_therapist.sql) e a trial_data
-- (20260908151211_trial_data_rls_supervisor.sql): gestor também cobre/
-- assina sessão de sessão de terapeuta, então precisa do mesmo acesso de
-- escrita que terapeuta/supervisor já têm aqui.

drop policy session_notes_insert on session_notes;
create policy session_notes_insert on session_notes for insert to authenticated
  with check (
    therapist_id = (select auth.uid())
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_notes.appointment_id
        and p.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) = any (array['terapeuta','supervisor','gestor'])
  );
