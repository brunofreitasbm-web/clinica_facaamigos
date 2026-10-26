-- Ajuste de frequência: exclusão de leads de mensagem única não precisa
-- rodar de hora em hora. Passa a rodar a cada 2 dias, às 03h.

do $$
begin
  perform cron.unschedule('delete_single_message_leads_hourly');
exception when others then
  raise notice 'job delete_single_message_leads_hourly não existia: %', sqlerrm;
end;
$$;

do $$
begin
  perform cron.schedule(
    'delete_single_message_leads_daily',
    '0 3 * * *',
    $job$select delete_single_message_leads();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende delete_single_message_leads() externamente. %', sqlerrm;
end;
$$;
