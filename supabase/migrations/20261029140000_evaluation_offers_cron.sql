-- Cron da oferta automática de horários da 1ª avaliação: a cada 30min chama
-- /api/twilio/evaluation-offers/tick (lembrete com 24h, expira com 48h —
-- lib/evaluation-offer.ts::tickEvaluationOffers).
--
-- Mesmo padrão dos crons que funcionam em produção (twilio_inbound_retry,
-- dispatch_anamnesis_prefill_reminders): URL literal no comando e o segredo
-- lido do Vault (`cron_secret`, ver 20260921040000). `app.settings.*` não
-- existe aqui (o role postgres não é superuser). Aplicar DEPOIS de
-- 20261029130000_evaluation_offers.sql e do deploy da rota — antes disso o
-- job só receberia 404, sem efeito.

do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — agende /api/twilio/evaluation-offers/tick manualmente.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'evaluation_offers_tick';
  perform cron.schedule(
    'evaluation_offers_tick',
    '*/30 * * * *',
    $cmd$
      select net.http_post(
        url := 'https://sistema.institutofacaamigos.com.br/api/twilio/evaluation-offers/tick',
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
  raise notice 'não foi possível agendar evaluation_offers_tick: %', sqlerrm;
end;
$$;
