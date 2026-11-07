-- 20261107120000_handoff_resume.sql
-- Retomada do fluxo depois do pedido de atendente + SLA de conversa pendente.
--
-- Hoje, quando o lead pede atendente no meio do AGENDAR (ou da escolha de horário da
-- 1ª avaliação), o bot silencia e a etapa se perde. Agora o escalonamento guarda uma
-- foto da sessão (`handoff_resume`) e o cron /api/twilio/handoff-resume oferece
-- "quer continuar de onde paramos?" depois de `handoff_resume_minutes` sem humano.
-- Convive com `bot_auto_resume_hours` (20260924010000): aquele religa o bot em HORAS,
-- sem restaurar etapa; este atua em MINUTOS e só oferece (o bot só volta se o lead
-- responder SIM/MENU).

alter table twilio_conversations add column if not exists handoff_resume jsonb;
alter table twilio_conversations add column if not exists pending_sla_notified_at timestamptz;

comment on column twilio_conversations.handoff_resume is
  'Foto da sessão do bot no escalonamento: {step, flow, lead_id, collected_data, captured_at, offered_at}. Nulo = nada a retomar.';
comment on column twilio_conversations.pending_sla_notified_at is
  'Quando a equipe foi alertada de que esta conversa pendente passou do SLA (um alerta por escalonamento).';

alter table chatbot_settings add column if not exists handoff_resume_minutes int default 15;
alter table chatbot_settings add column if not exists pending_sla_minutes int default 30;

comment on column chatbot_settings.handoff_resume_minutes is
  'Minutos sem resposta humana após o pedido de atendente até o bot oferecer retomar o fluxo. Null/0 = desligado.';
comment on column chatbot_settings.pending_sla_minutes is
  'Minutos em horário comercial até alertar a equipe de conversa pendente sem resposta. Null/0 = desligado.';

-- Cron (mesmo padrão dos demais: URL literal + segredo no Vault).
-- Aplicar DEPOIS do deploy da rota — antes disso o job só receberia 404.
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — agende /api/twilio/handoff-resume manualmente (*/5 * * * *).';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'twilio_handoff_resume';
  perform cron.schedule(
    'twilio_handoff_resume',
    '*/5 * * * *',
    $cmd$
      select net.http_post(
        url := 'https://sistema.institutofacaamigos.com.br/api/twilio/handoff-resume',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
exception when others then
  raise notice 'não foi possível agendar o cron de retomada: %', sqlerrm;
end;
$$;
