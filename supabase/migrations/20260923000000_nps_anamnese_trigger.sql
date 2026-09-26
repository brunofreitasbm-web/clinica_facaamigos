-- supabase/migrations/20260923000000_nps_anamnese_trigger.sql
--
-- Atualiza a constraint de alvo em nps_surveys para permitir pesquisas de NPS
-- de 1ª Avaliação / Anamnese criadas diretamente após o registro da anamnese,
-- mesmo quando não há appointment_id ou meeting_id associado.

alter table nps_surveys drop constraint if exists nps_surveys_target_check;
alter table nps_surveys add constraint nps_surveys_target_check
  check (
    (trigger_type = 'mensal' and appointment_id is null and meeting_id is null and period is not null)
    or (trigger_type <> 'mensal' and period is null)
  );
