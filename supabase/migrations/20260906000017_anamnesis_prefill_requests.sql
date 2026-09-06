-- supabase/migrations/20260906000017_anamnesis_prefill_requests.sql
-- Anamnese assíncrona pré-consulta: ao agendar a avaliação (recepção,
-- app/recepcao/pacientes/[id]/stage-actions.ts::scheduleEvaluation), a
-- clínica dispara um link/conversa de anamnese via WhatsApp (lib/twilio.ts)
-- para o responsável responder antes da consulta, com lembrete em 48h se
-- não respondeu. Mesmo desenho de nps_surveys/absence_alerts: tabela de
-- rastreio + envio real em TypeScript via pg_net -> rota Next.js, pg_cron
-- agendando a rota de lembrete.
--
-- Importante (ética/CFP e afins — anamnese não pode ser delegada ao bot):
-- esta tabela guarda um PRÉ-preenchimento de apoio, revisado e aprofundado
-- pelo terapeuta na consulta. O registro clínico oficial continua sendo
-- `anamneses` (20260906000001_intake_journey.sql), preenchido pelo
-- profissional em app/supervisao/pacientes/[id]/anamnese. O responsável pode
-- recusar (status='recusado') e preencher tudo presencialmente sem prejuízo.

create table anamnesis_prefill_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  appointment_id uuid not null references appointments(id),
  guardian_id uuid not null references guardians(id),
  phone_number text not null,
  status text not null default 'enviado'
    check (status in ('enviado','respondido','lembrete_enviado','recusado')),
  structured jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  reminder_sent_at timestamptz,
  responded_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now()
);

-- Um pedido por avaliação — evita reenvio duplicado se scheduleEvaluation
-- for chamado mais de uma vez para o mesmo appointment.
create unique index anamnesis_prefill_requests_appointment_unique on anamnesis_prefill_requests (appointment_id);
create index anamnesis_prefill_requests_phone_idx on anamnesis_prefill_requests (phone_number);
create index anamnesis_prefill_requests_pending_idx on anamnesis_prefill_requests (status) where status in ('enviado','lembrete_enviado');

alter table anamnesis_prefill_requests enable row level security;

-- Leitura para a equipe (recepção/supervisão/gestão vê tudo da clínica;
-- terapeuta só o que tem vínculo com o paciente) — mesmo padrão de
-- absence_alerts_read. A família não lê esta tabela pelo portal; ela
-- responde pelo WhatsApp, fora do app.
create policy anamnesis_prefill_requests_read on anamnesis_prefill_requests for select
  using (
    exists (select 1 from patients pt where pt.id = anamnesis_prefill_requests.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao')
      or has_patient_access(anamnesis_prefill_requests.patient_id, array['terapeuta'])
    )
  );

-- Sem policy de insert/update para papéis de aplicação: o disparo inicial
-- (scheduleEvaluation), a resposta via bot (webhook) e o lembrete (rota de
-- cron) escrevem via admin client — mesmo padrão de nps_surveys/
-- anamnesis_scheduling_requests.

-- Agendamento do lembrete: pg_net chama a rota Next.js que varre pedidos
-- com status='enviado' há mais de 48h e ainda sem resposta, e envia reforço
-- via Twilio. Requer, após o deploy, as mesmas settings já documentadas em
-- nps_surveys/absence_alerts:
--   alter database postgres set app.settings.app_url = 'https://<dominio>';
--   alter database postgres set app.settings.cron_secret = '<mesmo valor de CRON_SECRET>';
-- Se essas settings não existirem ainda, o bloco falha isolado (como os
-- demais jobs pg_cron deste projeto) sem impedir o resto da migration.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
    'dispatch_anamnesis_prefill_reminders',
    '*/30 * * * *',
    $job$
      select net.http_post(
        url := coalesce(current_setting('app.settings.app_url', true), '') || '/api/twilio/anamnesis-prefill/trigger',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net indisponível neste ambiente — dispare /api/twilio/anamnesis-prefill/trigger externamente. %', sqlerrm;
end;
$$;
