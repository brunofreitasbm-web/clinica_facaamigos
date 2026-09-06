-- supabase/migrations/20260906000008_revoke_intake_trigger_execute.sql
-- Mesmo padrão de 20260904000028_revoke_cron_function_public_execute.sql: as
-- funções SECURITY DEFINER dos triggers de sincronização da jornada de
-- entrada não deveriam ser chamáveis diretamente via /rest/v1/rpc/... (isso
-- bypassaria a RLS de intake_steps/treatment_plans/patients). O advisor de
-- segurança acusou seed_intake_steps, trg_anamneses_after_insert,
-- trg_meetings_after_insert e trg_patients_seed_intake_steps como
-- executáveis por anon/authenticated logo após a criação — fechando aqui e
-- estendendo às demais funções da mesma família por consistência.

revoke execute on function seed_intake_steps(uuid) from public, anon, authenticated;
revoke execute on function set_intake_step_complete(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function set_intake_step_na(uuid, text) from public, anon, authenticated;
revoke execute on function trg_patients_seed_intake_steps() from public, anon, authenticated;
revoke execute on function trg_patients_intake_sync() from public, anon, authenticated;
revoke execute on function trg_patient_insurance_intake_sync() from public, anon, authenticated;
revoke execute on function trg_anamneses_after_insert() from public, anon, authenticated;
revoke execute on function trg_patient_access_intake_sync() from public, anon, authenticated;
revoke execute on function trg_treatment_plans_intake_sync() from public, anon, authenticated;
revoke execute on function trg_meetings_after_insert() from public, anon, authenticated;
revoke execute on function trg_documents_intake_sync() from public, anon, authenticated;
