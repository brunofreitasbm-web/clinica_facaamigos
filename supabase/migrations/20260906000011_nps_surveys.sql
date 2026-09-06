-- supabase/migrations/20260906000011_nps_surveys.sql
-- Disparo automático de pesquisa NPS (1-5) via WhatsApp, 1h após reavaliação
-- (appointments.is_evaluation) ou reunião de devolutiva/feedback com a
-- supervisão (meetings.kind = 'devolutiva'). Distinta de `survey_responses`
-- (NPS 0-10 preenchido pela família no portal) — fluxo e escala diferentes.

create table nps_surveys (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id),
  meeting_id uuid references meetings(id),
  patient_id uuid not null references patients(id),
  guardian_id uuid not null references guardians(id),
  phone_number text not null,
  dispatched_at timestamptz not null default now(),
  responded_at timestamptz,
  score smallint check (score between 1 and 5),
  feedback_text text,
  alert_status text not null default 'ok' check (alert_status in ('ok','pending_contact','em_atendimento','resolvido')),
  alert_updated_by uuid references profiles(id),
  alert_updated_at timestamptz,
  created_at timestamptz not null default now(),
  check ((appointment_id is not null) <> (meeting_id is not null))
);

create unique index nps_surveys_appointment_unique on nps_surveys (appointment_id) where appointment_id is not null;
create unique index nps_surveys_meeting_unique on nps_surveys (meeting_id) where meeting_id is not null;
create index nps_surveys_phone_idx on nps_surveys (phone_number);
create index nps_surveys_alert_idx on nps_surveys (alert_status) where alert_status <> 'ok';

alter table nps_surveys enable row level security;

create policy nps_surveys_read on nps_surveys for select
  using (
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from patients pt where pt.id = nps_surveys.patient_id and pt.clinic_id = current_clinic_id())
  );

-- Sem policy de insert para papéis de aplicação: o disparo (dispatched_at) e o
-- registro da resposta (score/responded_at) só acontecem via admin client,
-- a partir da rota de cron (/api/twilio/nps/trigger) e do webhook do Twilio —
-- mesmo padrão de `anamnesis_scheduling_requests`/`chatbot_sessions`.
create policy nps_surveys_update_alert on nps_surveys for update
  using (
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from patients pt where pt.id = nps_surveys.patient_id and pt.clinic_id = current_clinic_id())
  );

-- Agendamento do disparo: pg_net chama a rota Next.js que faz a consulta de
-- elegibilidade e o envio via Twilio (lib/twilio.ts), mantendo a lógica de
-- negócio em TypeScript. Requer, após o deploy, configurar:
--   alter database postgres set app.settings.app_url = 'https://<dominio>';
--   alter database postgres set app.settings.cron_secret = '<mesmo valor de CRON_SECRET>';
-- Se essas settings não existirem ainda, o bloco falha isolado (como os
-- demais jobs pg_cron deste projeto) sem impedir o resto da migration.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
    'dispatch_nps_surveys',
    '*/10 * * * *',
    $job$
      select net.http_post(
        url := coalesce(current_setting('app.settings.app_url', true), '') || '/api/twilio/nps/trigger',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net indisponível neste ambiente — dispare /api/twilio/nps/trigger externamente. %', sqlerrm;
end;
$$;
