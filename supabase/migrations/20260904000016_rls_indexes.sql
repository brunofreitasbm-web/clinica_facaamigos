-- supabase/migrations/20260904000016_rls_indexes.sql
-- Índices nas colunas usadas nos JOINs de isolamento por clínica (clinic_id
-- direto) e nas colunas de FK que servem de ponte até clinic_id dentro das
-- policies RLS (ex: appointments.patient_id -> patients.clinic_id). Postgres
-- não cria índice automático em coluna de FK — sem isso toda policy RLS faz
-- sequential scan à medida que as tabelas crescem (achado M8 do review final
-- da Fase 0, deferred para antes da Fase 1).

-- Colunas clinic_id diretas
create index if not exists idx_profiles_clinic_id on profiles (clinic_id);
create index if not exists idx_rooms_clinic_id on rooms (clinic_id);
create index if not exists idx_patients_clinic_id on patients (clinic_id);
create index if not exists idx_insurers_clinic_id on insurers (clinic_id);
create index if not exists idx_domain_taxonomy_clinic_id on domain_taxonomy (clinic_id);
create index if not exists idx_protocols_clinic_id on protocols (clinic_id);
create index if not exists idx_targets_clinic_id on targets (clinic_id);
create index if not exists idx_audit_log_clinic_id on audit_log (clinic_id);

-- FKs usados como ponte até clinic_id (ou até auth.uid()) nas policies RLS
create index if not exists idx_therapist_contracts_profile_id on therapist_contracts (profile_id);
create index if not exists idx_guardians_patient_id on guardians (patient_id);
create index if not exists idx_guardians_profile_id on guardians (profile_id);
create index if not exists idx_patient_access_patient_id on patient_access (patient_id);
create index if not exists idx_patient_access_profile_id on patient_access (profile_id);
create index if not exists idx_insurer_price_tables_insurer_id on insurer_price_tables (insurer_id);
create index if not exists idx_patient_insurance_patient_id on patient_insurance (patient_id);
create index if not exists idx_patient_insurance_insurer_id on patient_insurance (insurer_id);
create index if not exists idx_authorizations_patient_insurance_id on authorizations (patient_insurance_id);
create index if not exists idx_protocol_items_protocol_id on protocol_items (protocol_id);
create index if not exists idx_protocol_assessments_patient_id on protocol_assessments (patient_id);
create index if not exists idx_protocol_assessments_protocol_id on protocol_assessments (protocol_id);
create index if not exists idx_treatment_plans_patient_id on treatment_plans (patient_id);
create index if not exists idx_plan_goals_treatment_plan_id on plan_goals (treatment_plan_id);
create index if not exists idx_programs_plan_goal_id on programs (plan_goal_id);
create index if not exists idx_appointments_patient_id on appointments (patient_id);
create index if not exists idx_appointments_therapist_id on appointments (therapist_id);
create index if not exists idx_appointments_room_id on appointments (room_id);
create index if not exists idx_appointments_authorization_id on appointments (authorization_id);
create index if not exists idx_session_notes_appointment_id on session_notes (appointment_id);
create index if not exists idx_session_notes_therapist_id on session_notes (therapist_id);
create index if not exists idx_trial_data_appointment_id on trial_data (appointment_id);
create index if not exists idx_trial_data_program_id on trial_data (program_id);
create index if not exists idx_documents_patient_id on documents (patient_id);
create index if not exists idx_billing_periods_insurer_id on billing_periods (insurer_id);
create index if not exists idx_billing_items_billing_period_id on billing_items (billing_period_id);
create index if not exists idx_billing_items_appointment_id on billing_items (appointment_id);
create index if not exists idx_glosas_billing_item_id on glosas (billing_item_id);
create index if not exists idx_glosas_attributable_profile_id on glosas (attributable_profile_id);
create index if not exists idx_payouts_therapist_id on payouts (therapist_id);
create index if not exists idx_payout_items_payout_id on payout_items (payout_id);
create index if not exists idx_payout_items_appointment_id on payout_items (appointment_id);
create index if not exists idx_messages_patient_id on messages (patient_id);
create index if not exists idx_messages_guardian_id on messages (guardian_id);
create index if not exists idx_survey_responses_patient_id on survey_responses (patient_id);
create index if not exists idx_survey_responses_guardian_id on survey_responses (guardian_id);
create index if not exists idx_record_access_log_patient_id on record_access_log (patient_id);

-- audit_log é consultado por (table_name, row_id) fora do clinic_id — índice composto
create index if not exists idx_audit_log_table_row on audit_log (table_name, row_id);

-- metric_snapshots_read faz exists(...) sobre scope_type/scope_id
create index if not exists idx_metric_snapshots_scope on metric_snapshots (scope_type, scope_id);
