-- supabase/migrations/20260905123902_fk_covering_indexes.sql
-- Índices de cobertura para FKs do domínio clínico sem índice (achado
-- unindexed_foreign_keys do advisor de performance). Sem índice, joins por
-- essas colunas e o passo de checagem de FK em delete/update na tabela pai
-- caem em sequential scan à medida que a tabela cresce.
create index if not exists idx_patients_created_by on public.patients (created_by);
create index if not exists idx_patient_access_granted_by on public.patient_access (granted_by);
create index if not exists idx_authorizations_previous_authorization_id on public.authorizations (previous_authorization_id);
create index if not exists idx_protocols_digitization_risk_accepted_by on public.protocols (digitization_risk_accepted_by);
create index if not exists idx_protocol_assessments_assessed_by on public.protocol_assessments (assessed_by);
create index if not exists idx_treatment_plans_approved_by on public.treatment_plans (approved_by);
create index if not exists idx_plan_goals_validated_by on public.plan_goals (validated_by);
create index if not exists idx_programs_protocol_item_id on public.programs (protocol_item_id);
create index if not exists idx_programs_domain_taxonomy_id on public.programs (domain_taxonomy_id);
create index if not exists idx_appointments_cancelled_by on public.appointments (cancelled_by);
create index if not exists idx_session_notes_supersedes_id on public.session_notes (supersedes_id);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_messages_related_appointment_id on public.messages (related_appointment_id);
create index if not exists idx_record_access_log_accessed_by on public.record_access_log (accessed_by);
create index if not exists idx_feed_posts_author_id on public.feed_posts (author_id);
create index if not exists idx_feed_posts_patient_id on public.feed_posts (patient_id);
create index if not exists idx_feed_media_post_id on public.feed_media (post_id);
create index if not exists idx_absence_reports_appointment_id on public.absence_reports (appointment_id);
create index if not exists idx_absence_reports_reported_by on public.absence_reports (reported_by);
create index if not exists idx_absence_reports_resolved_by on public.absence_reports (resolved_by);
create index if not exists idx_resources_clinic_id on public.resources (clinic_id);
create index if not exists idx_resource_bookings_appointment_id on public.resource_bookings (appointment_id);
create index if not exists idx_resource_bookings_booked_by on public.resource_bookings (booked_by);
create index if not exists idx_draft_reports_patient_id on public.draft_reports (patient_id);
create index if not exists idx_draft_reports_generated_by on public.draft_reports (generated_by);
create index if not exists idx_draft_reports_approved_by on public.draft_reports (approved_by);
create index if not exists idx_patient_tags_patient_id on public.patient_tags (patient_id);
create index if not exists idx_patient_tags_created_by on public.patient_tags (created_by);
create index if not exists idx_patient_charges_created_by on public.patient_charges (created_by);
create index if not exists idx_patient_charges_patient_id on public.patient_charges (patient_id);
create index if not exists idx_aba_abc_logs_therapist_id on public.aba_abc_logs (therapist_id);
