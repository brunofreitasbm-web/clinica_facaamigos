-- "1ª onda" da oferta de horários da 1ª avaliação: o primeiro disparo automático a todos os
-- pacientes que já esperam a avaliação com o plano autorizado (lib/evaluation-offer-wave.ts).
--
-- Exceção à regra da data mais próxima (sugerir a partir de AMANHÃ): durante a onda, os
-- horários só podem cair a partir de `wave_earliest_date` (06/11/2026). A exceção some
-- sozinha quando "amanhã" passa dessa data (lib/evaluation-offer-wave-pure.ts).
--
-- A chave nasce DESLIGADA. Ligar = update de wave_enabled, só depois de os templates da Meta
-- estarem aprovados e configurados na Vercel. O cron de 5 em 5 minutos só age com a chave
-- ligada, em dia útil, das 08h às 18h, com a clínica aberta; envia lotes e, quando não sobra
-- ninguém, desliga a chave e avisa a supervisão (push + e-mail).

create table evaluation_offer_settings (
  clinic_id uuid primary key references clinics(id) on delete cascade,
  wave_enabled boolean not null default false,
  wave_batch_size integer not null default 10 check (wave_batch_size between 1 and 50),
  wave_earliest_date date,
  wave_started_at timestamptz,
  wave_finished_at timestamptz,
  wave_summary jsonb,
  updated_at timestamptz not null default now()
);

alter table evaluation_offer_settings enable row level security;

create policy evaluation_offer_settings_read on evaluation_offer_settings for select
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor']));
create policy evaluation_offer_settings_update on evaluation_offer_settings for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['gestor','supervisor']));

insert into evaluation_offer_settings (clinic_id, wave_enabled, wave_batch_size, wave_earliest_date)
select id, false, 10, date '2026-11-06' from clinics
on conflict (clinic_id) do nothing;

-- Crons (mesmo padrão dos que funcionam: URL literal + segredo no Vault, ver 20260921040000).
-- Aplicar DEPOIS do deploy das rotas — antes disso o job só receberia 404.
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — agende as rotas /api/twilio/evaluation-offers/wave e /digest manualmente.';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'evaluation_offers_wave';
  perform cron.schedule(
    'evaluation_offers_wave',
    '*/5 * * * *',
    $cmd$
      select net.http_post(
        url := 'https://sistema.institutofacaamigos.com.br/api/twilio/evaluation-offers/wave',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );

  -- Resumo das 8h (11:02 UTC = 08:02 em Brasília), segunda a sexta.
  perform cron.unschedule(jobid) from cron.job where jobname = 'evaluation_offers_pending_digest';
  perform cron.schedule(
    'evaluation_offers_pending_digest',
    '2 11 * * 1-5',
    $cmd$
      select net.http_post(
        url := 'https://sistema.institutofacaamigos.com.br/api/twilio/evaluation-offers/digest',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
exception when others then
  raise notice 'não foi possível agendar os crons da onda: %', sqlerrm;
end;
$$;
