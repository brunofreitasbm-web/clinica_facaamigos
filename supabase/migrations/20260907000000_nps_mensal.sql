-- Disparo mensal de NPS (0-10) via WhatsApp, independente de evento
-- (avaliação/devolutiva), para todo paciente ativo. Reaproveita a tabela
-- nps_surveys (20260906000011) em vez de criar uma tabela nova: mesmo
-- webhook de resposta, mesma triagem de detrator no dashboard/supervisão.
--
-- Isso exige relaxar a constraint original, que obrigava exatamente um de
-- appointment_id/meeting_id: o disparo mensal não tem nenhum dos dois, tem
-- em vez disso um `period` ('YYYY-MM') que identifica o mês da campanha.
-- A escala do disparo mensal é 0-10 (NPS "de verdade"), diferente da escala
-- 1-5 usada nos disparos por evento — daí o novo campo trigger_type, usado
-- pelo webhook (lib/twilio.ts) pra saber qual faixa de nota aceitar e qual
-- limiar usar pra marcar detrator.

alter table nps_surveys
  add column trigger_type text not null default 'evaluation'
    check (trigger_type in ('evaluation', 'devolutiva', 'mensal')),
  add column period text
    check (period is null or period ~ '^\d{4}-\d{2}$');

update nps_surveys set trigger_type = 'devolutiva' where meeting_id is not null;

-- Substitui a constraint de exclusividade original (appointment_id XOR
-- meeting_id) por uma que também cobre o caso mensal (nenhum dos dois,
-- period obrigatório).
alter table nps_surveys drop constraint nps_surveys_check;
alter table nps_surveys add constraint nps_surveys_target_check
  check (
    (trigger_type = 'mensal' and appointment_id is null and meeting_id is null and period is not null)
    or (trigger_type <> 'mensal' and (appointment_id is not null) <> (meeting_id is not null) and period is null)
  );

-- Amplia a faixa de nota aceita de 1-5 para 0-10 (a escala do disparo
-- mensal); os fluxos por evento continuam gravando 1-5, só um subconjunto.
alter table nps_surveys drop constraint nps_surveys_score_check;
alter table nps_surveys add constraint nps_surveys_score_check check (score between 0 and 10);

-- Dedup: no máximo um disparo mensal por paciente por período civil.
create unique index nps_surveys_mensal_period_unique
  on nps_surveys (patient_id, period)
  where trigger_type = 'mensal';

create index nps_surveys_trigger_type_idx on nps_surveys (trigger_type);

-- Agendamento mensal: pg_net chama a rota Next.js que resolve elegibilidade
-- (patients.status = 'ativo') e faz o envio via Twilio (lib/twilio.ts) —
-- mesmo padrão de dispatch_nps_surveys/dispatch_absence_alerts. Todo dia 1
-- às 9h (horário do banco, UTC); a rota é idempotente por period, então uma
-- reexecução no mesmo mês não duplica disparo. Requer, após o deploy, as
-- mesmas settings já documentadas em 20260906000011_nps_surveys.sql:
--   alter database postgres set app.settings.app_url = 'https://<dominio>';
--   alter database postgres set app.settings.cron_secret = '<mesmo valor de CRON_SECRET>';
-- Se essas settings não existirem ainda, o bloco falha isolado (como os
-- demais jobs pg_cron deste projeto) sem impedir o resto da migration.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
    'dispatch_nps_mensal',
    '0 9 1 * *',
    $job$
      select net.http_post(
        url := coalesce(current_setting('app.settings.app_url', true), '') || '/api/twilio/nps-mensal/trigger',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net indisponível neste ambiente — dispare /api/twilio/nps-mensal/trigger externamente. %', sqlerrm;
end;
$$;
