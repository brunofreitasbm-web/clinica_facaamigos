-- supabase/migrations/20260913240000_audit_log_allow_google_calendar_actions.sql
-- A edge function sync-google-calendar (supabase/functions/sync-google-calendar)
-- grava no audit_log as ações abaixo — precisam entrar na CHECK constraint,
-- senão o insert falha silenciosamente (mesmo problema já corrigido em
-- 20260910010000 para o sync do Grupo IB).
alter table public.audit_log drop constraint audit_log_action_check;

alter table public.audit_log add constraint audit_log_action_check
check (action = ANY (ARRAY[
  'INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'download'::text,
  'draft_validated'::text, 'draft_rejected'::text, 'draft_extracted'::text,
  'intake_batch_uploaded'::text, 'intake_batch_extracted'::text,
  'intake_lead_approved'::text, 'intake_contact_sent'::text,
  'intake_docs_approved'::text, 'intake_docs_rejected'::text,
  'intake_lead_scheduled'::text, 'intake_lead_cancelled'::text,
  'grupoib_sync_access_email_sent'::text, 'grupoib_sync_access_email_failed'::text,
  'grupoib_sync_role_pending_review'::text,
  'staff_password_reset'::text, 'staff_signature_pin_reset'::text,
  'google_calendar_event_created'::text, 'google_calendar_event_updated'::text,
  'google_calendar_event_cancelled'::text, 'google_calendar_sync_failed'::text,
  'google_calendar_token_refresh_failed'::text
]));
