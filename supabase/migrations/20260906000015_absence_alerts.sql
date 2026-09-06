-- supabase/migrations/20260906000015_absence_alerts.sql
-- Gestão de faltas (regra MAAIS §13, adaptada ao que o PRD já chama de
-- "evasão silenciosa" e "risco de evasão" — §10.2/linha 390): paciente com
-- 3 faltas consecutivas OU >=50% de faltas em appointments nos últimos 3
-- meses gera um alerta e um aviso à família, nos canais portal e whatsapp.
-- Mesmo desenho de reassessment_alerts (20260904000019) e nps_surveys
-- (20260906000011): tabela de alerta + função pura de cálculo em SQL,
-- disparo real do WhatsApp em TypeScript via pg_net -> rota Next.js
-- (lib/twilio.ts), pg_cron agendando a rota.

create table absence_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  consecutive_faltas int not null,
  faltas_pct_3m numeric not null,
  status text not null default 'pendente' check (status in ('pendente','notificado','resolvido')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz
);

-- Índice parcial: só o que a rotina (refresh_absence_alerts) e a tela de
-- disparo (rota de cron) precisam varrer.
create index absence_alerts_pending_idx on absence_alerts (patient_id) where status in ('pendente','notificado');

alter table absence_alerts enable row level security;

-- Inclui 'responsavel' (mesmo padrão de treatment_plans_read) — a família
-- vê o próprio alerta no portal (app/familia), não só a equipe.
create policy absence_alerts_read on absence_alerts for select
  using (
    exists (select 1 from patients pt where pt.id = absence_alerts.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao')
      or has_patient_access(absence_alerts.patient_id, array['terapeuta','responsavel'])
    )
  );

-- Só recepção/supervisor/gestor resolvem o alerta (mesmo conjunto de papéis
-- que atua em appointments_update/messages_write) — quem entra em contato
-- com a família marca como 'resolvido' manualmente; 'pendente'/'notificado'
-- são geridos só pela rotina abaixo.
create policy absence_alerts_update on absence_alerts for update
  using (
    exists (select 1 from patients pt where pt.id = absence_alerts.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

-- Cálculo puro, sem efeito colateral — reutilizável tanto pela rotina de
-- alerta quanto por qualquer painel que queira mostrar o indicador bruto.
create function patient_absence_stats(p_patient_id uuid)
returns table(consecutive_faltas int, faltas_pct_3m numeric)
language plpgsql stable as $$
declare
  r record;
  v_consecutive int := 0;
  v_counting boolean := true;
  v_total_3m int := 0;
  v_faltas_3m int := 0;
begin
  for r in
    select status, starts_at
    from appointments
    where patient_id = p_patient_id
      and status in ('realizada','falta_familia')
    order by starts_at desc
  loop
    if v_counting then
      if r.status = 'falta_familia' then
        v_consecutive := v_consecutive + 1;
      else
        v_counting := false;
      end if;
    end if;
    if r.starts_at >= now() - interval '3 months' then
      v_total_3m := v_total_3m + 1;
      if r.status = 'falta_familia' then
        v_faltas_3m := v_faltas_3m + 1;
      end if;
    end if;
  end loop;

  consecutive_faltas := v_consecutive;
  faltas_pct_3m := case when v_total_3m > 0 then round(100.0 * v_faltas_3m / v_total_3m, 1) else 0 end;
  return next;
end;
$$;

-- security definer (mesmo padrão de refresh_reassessment_alerts): roda via
-- pg_cron sem sessão de usuário autenticado, precisa escrever em
-- absence_alerts/messages de todos os pacientes independente de RLS. Sem
-- parâmetro (varre a base toda) — a UI é single-tenant nesta fase (ver
-- PRODUCT.md), mesma premissa de refresh_reassessment_alerts/
-- close_monthly_metric_snapshots.
create function refresh_absence_alerts() returns int
language plpgsql security definer set search_path = public as $$
declare
  p record;
  stats record;
  v_alert_id uuid;
  v_created int := 0;
begin
  for p in
    select id from patients where status in ('ativo','pausado')
  loop
    select * into stats from patient_absence_stats(p.id);

    if stats.consecutive_faltas < 3 and stats.faltas_pct_3m < 50 then
      continue;
    end if;

    -- Dedup: não abre novo alerta se já existe um 'pendente'/'notificado'
    -- para este paciente nos últimos 30 dias — evita reenviar aviso a cada
    -- execução do cron enquanto a família não resolve a pendência.
    if exists (
      select 1 from absence_alerts
      where patient_id = p.id
        and status in ('pendente','notificado')
        and created_at >= now() - interval '30 days'
    ) then
      continue;
    end if;

    insert into absence_alerts (patient_id, consecutive_faltas, faltas_pct_3m)
    values (p.id, stats.consecutive_faltas, stats.faltas_pct_3m)
    returning id into v_alert_id;

    insert into messages (patient_id, channel, direction, template_key, body, sent_at)
    values (
      p.id,
      'portal',
      'outbound',
      'aviso_faltas',
      'Notamos algumas faltas recentes. Se está difícil manter os horários, fala com a recepção — a gente ajuda a reorganizar a agenda.',
      now()
    );

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke execute on function refresh_absence_alerts() from public, anon, authenticated;

-- Agendamento: pg_net chama a rota Next.js que resolve elegibilidade
-- (patient_absence_stats/refresh_absence_alerts) e faz o envio via Twilio
-- (lib/twilio.ts), mantendo a lógica de negócio em TypeScript — mesmo
-- padrão de dispatch_nps_surveys (20260906000011). Requer, após o deploy,
-- as mesmas settings já documentadas ali:
--   alter database postgres set app.settings.app_url = 'https://<dominio>';
--   alter database postgres set app.settings.cron_secret = '<mesmo valor de CRON_SECRET>';
-- Se essas settings não existirem ainda, o bloco falha isolado (como os
-- demais jobs pg_cron deste projeto) sem impedir o resto da migration.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
    'dispatch_absence_alerts',
    '0 6 * * *',
    $job$
      select net.http_post(
        url := coalesce(current_setting('app.settings.app_url', true), '') || '/api/twilio/absence/trigger',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net indisponível neste ambiente — dispare /api/twilio/absence/trigger externamente. %', sqlerrm;
end;
$$;
