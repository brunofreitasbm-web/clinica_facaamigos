-- A edge function sync-grupoib-professional (supabase/functions/sync-grupoib-professional)
-- grava no audit_log as ações grupoib_sync_access_email_sent/failed e
-- grupoib_sync_role_pending_review, mas essas ações nunca tinham sido incluídas
-- na CHECK constraint da tabela. Resultado: todo insert vindo dessa função
-- falhava silenciosamente (o código não confere o retorno do insert), então o
-- envio de e-mail de primeiro acesso ficava sem nenhum rastro no audit_log,
-- inclusive nos casos de falha — justo o cenário que o comentário no código da
-- função descreve como "precisa ficar registrado para alguém agir manualmente".
-- Achado e corrigido durante o teste de ponta a ponta da migração Resend -> Brevo.
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
  'grupoib_sync_role_pending_review'::text
]));
