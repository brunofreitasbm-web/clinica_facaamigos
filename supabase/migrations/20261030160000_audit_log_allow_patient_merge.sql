-- merge_duplicate_patients (20261030150000) grava action 'MERGE' no audit_log, mas
-- audit_log_action_check não a admitia: a primeira fusão real falhou e foi
-- desfeita por inteiro. Acrescenta 'MERGE' à lista (mesmas ações de antes).
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action = ANY (ARRAY[
  'INSERT', 'UPDATE', 'DELETE', 'download', 'draft_validated', 'draft_rejected', 'draft_extracted',
  'intake_batch_uploaded', 'intake_batch_extracted', 'intake_lead_approved', 'intake_contact_sent',
  'intake_docs_approved', 'intake_docs_rejected', 'intake_lead_scheduled', 'intake_lead_cancelled',
  'grupoib_sync_access_email_sent', 'grupoib_sync_access_email_failed', 'grupoib_sync_role_pending_review',
  'staff_password_reset', 'staff_signature_pin_reset',
  'google_calendar_event_created', 'google_calendar_event_updated', 'google_calendar_event_cancelled',
  'google_calendar_sync_failed', 'google_calendar_token_refresh_failed',
  'receipt_generated', 'receipt_sent', 'patient_auto_discharged', 'patient_reactivated',
  'acolhimento_status_changed', 'lead_registered', 'lead_enriched', 'MERGE'
]::text[]));
