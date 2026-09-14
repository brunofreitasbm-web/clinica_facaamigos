-- supabase/migrations/20260913230000_appointments_google_calendar.sql
-- Rastreamento do evento espelhado no Google Calendar (supabase/functions/
-- sync-google-calendar). google_event_id permite fazer PATCH/DELETE no
-- evento existente em vez de apagar e recriar a cada reagendamento — isso
-- evita mandar um novo convite (e derrubar o já aceito) a cada mudança de
-- horário. google_calendar_sync_status alimenta o reconciliador
-- (app/api/google-calendar/reconcile) que cobre falhas de webhook.
alter table appointments
  add column google_event_id text,
  add column google_calendar_synced_at timestamptz,
  add column google_calendar_sync_status text
    check (google_calendar_sync_status in ('pending', 'synced', 'failed', 'skipped'))
    not null default 'pending';

create index appointments_google_sync_pending_idx
  on appointments (id)
  where google_calendar_sync_status in ('pending', 'failed');
