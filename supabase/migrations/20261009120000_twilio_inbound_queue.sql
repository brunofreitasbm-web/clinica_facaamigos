-- Fila durável das mensagens WhatsApp recebidas (webhook da Twilio).
--
-- Antes: o webhook processava a mensagem e respondia 200. Se o app estivesse
-- fora (deploy, queda da Vercel) a Twilio não conseguia entregar e a resposta do
-- cliente se perdia; se o processamento quebrasse no meio, idem.
--
-- Agora: o payload é gravado AQUI antes de processar (app/api/webhooks/twilio),
-- a Edge Function twilio-inbound-fallback grava aqui quando a Twilio cai na URL de
-- fallback (app fora do ar) e o cron /api/twilio/inbound-retry reprocessa o que
-- estiver 'pending'. O processamento é idempotente por MessageSid
-- (messages.twilio_sid), então reprocessar nunca duplica a mensagem.

create table if not exists twilio_inbound_queue (
  message_sid text primary key,
  payload jsonb not null,
  source text not null default 'app' check (source in ('app', 'fallback')),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_twilio_inbound_queue_pending
  on twilio_inbound_queue (received_at) where status = 'pending';

-- Só service role (webhook, cron e Edge Function): RLS ligada e sem policy.
alter table twilio_inbound_queue enable row level security;

-- Cron a cada minuto, mesmo padrão dos demais (segredo no Vault, ver 20260921040000).
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — agende /api/twilio/inbound-retry manualmente.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'twilio_inbound_retry';
  perform cron.schedule(
    'twilio_inbound_retry',
    '* * * * *',
    $cmd$
      select net.http_post(
        url := 'https://sistema.institutofacaamigos.com.br/api/twilio/inbound-retry',
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
  raise notice 'não foi possível agendar twilio_inbound_retry: %', sqlerrm;
end;
$$;
