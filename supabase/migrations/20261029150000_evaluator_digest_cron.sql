-- E-mail diário às 7h59 (America/Sao_Paulo) com as avaliações do dia de cada
-- terapeuta avaliador. pg_cron roda em UTC e o Brasil não tem horário de
-- verão: 07:59 BRT = 10:59 UTC.
--
-- Mesmo padrão dos crons que funcionam (ver 20261029140000): URL literal e
-- segredo no Vault (`cron_secret`). Aplicar DEPOIS do deploy da rota
-- /api/twilio/evaluator-digest — antes disso o job só receberia 404.

do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — agende /api/twilio/evaluator-digest manualmente.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'evaluator_daily_digest';
  perform cron.schedule(
    'evaluator_daily_digest',
    '59 10 * * *',
    $cmd$
      select net.http_post(
        url := 'https://sistema.institutofacaamigos.com.br/api/twilio/evaluator-digest',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
            ''
          )
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
exception when others then
  raise notice 'não foi possível agendar evaluator_daily_digest: %', sqlerrm;
end;
$$;
