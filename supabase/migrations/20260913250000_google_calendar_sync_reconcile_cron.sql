-- supabase/migrations/20260913250000_google_calendar_sync_reconcile_cron.sql
-- Rede de segurança para supabase/functions/sync-google-calendar: o disparo
-- principal é o Database Webhook em appointments (configurado manualmente no
-- painel do Supabase, mesmo caminho já usado para sync-grupoib-professional).
-- Este cron cobre o caso do webhook não ter disparado (função fora do ar,
-- webhook mal configurado etc.) reprocessando o que ficou 'pending'/'failed'.
-- Mesmo padrão fail-soft de dispatch_absence_alerts (20260906000015): requer
--   alter database postgres set app.settings.app_url = 'https://<dominio>';
--   alter database postgres set app.settings.cron_secret = '<mesmo valor de CRON_SECRET>';
-- já configurados para os outros jobs deste projeto.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
    'reconcile_google_calendar_sync',
    '*/15 * * * *',
    $job$
      select net.http_post(
        url := coalesce(current_setting('app.settings.app_url', true), '') || '/api/google-calendar/reconcile',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net indisponível neste ambiente — dispare /api/google-calendar/reconcile externamente. %', sqlerrm;
end;
$$;
