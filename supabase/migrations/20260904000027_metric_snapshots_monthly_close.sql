-- supabase/migrations/20260904000027_metric_snapshots_monthly_close.sql
--
-- §10.6 do PRD: "pg_cron roda no dia 1 de cada mês: calcula cada view para
-- o período fechado e grava em metric_snapshots." Isso nunca foi
-- implementado — `metric_snapshots`/`targets` (20260904000011_metrics.sql)
-- existem no schema desde o início mas nunca receberam uma linha, porque
-- não há job nenhum que as popule. As telas de bonificação/painel executivo
-- (app/gestor/data.ts) contornam isso recalculando ao vivo a cada carga de
-- página — o que é correto para "o mês em andamento", mas não fecha
-- histórico algum pra auditoria/PLR de meses passados.
--
-- Este job fecha o mês anterior (o único already-completo quando ele roda
-- no dia 1) pras 3 métricas que já têm cálculo equivalente e testado em
-- app/gestor/data.ts (getBonusRows): no_show_rate, occupancy_rate,
-- glosa_rate — escopo 'clinica'. As demais ~18 métricas do §10 (recepção
-- completo, coordenação, terapeutas por profile, faturamento completo)
-- ficam pra quando cada uma tiver sua própria view SQL — não dá pra
-- inventar aqui todas de uma vez sem repetir o mesmo trabalho de validação
-- que essas 3 já passaram no app.

-- Idempotência: sem isso, rodar o job duas vezes no mesmo mês (reprocesso
-- manual, retry de falha) duplicaria a linha em vez de atualizar o valor.
create unique index if not exists metric_snapshots_period_unique
  on metric_snapshots (metric_key, scope_type, scope_id, period_start);

create function close_monthly_metric_snapshots() returns void
language plpgsql security definer set search_path = public as $$
declare
  clinic_row record;
  period_start date := date_trunc('month', now() - interval '1 month')::date;
  period_end date := date_trunc('month', now())::date;
  v_no_show numeric;
  v_occupancy numeric;
  v_glosa numeric;
  denom_count bigint;
  falta_count bigint;
  scheduled_hours numeric;
  realized_hours numeric;
  billed_total numeric;
  billed_glosado numeric;
begin
  for clinic_row in select id from clinics loop

    -- no_show_rate e occupancy_rate compartilham o mesmo denominador (§10.1
    -- no_show_rate / §10.2 occupancy_rate): sessões com desfecho no período,
    -- não só "realizada" — falta/cancelamento também contam pro total.
    select
      count(*) filter (where a.status in ('realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica')),
      count(*) filter (where a.status = 'falta_familia'),
      coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 3600.0)
        filter (where a.status in ('realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica')), 0),
      coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 3600.0)
        filter (where a.status = 'realizada'), 0)
    into denom_count, falta_count, scheduled_hours, realized_hours
    from appointments a
    join patients p on p.id = a.patient_id
    where p.clinic_id = clinic_row.id
      and a.starts_at >= period_start and a.starts_at < period_end;

    v_occupancy := case when scheduled_hours > 0 then realized_hours / scheduled_hours else null end;
    v_no_show := case when denom_count > 0 then falta_count::numeric / denom_count else null end;

    if v_no_show is not null then
      insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
      values ('no_show_rate', 'clinica', clinic_row.id, period_start, period_end, v_no_show)
      on conflict (metric_key, scope_type, scope_id, period_start)
      do update set value = excluded.value, period_end = excluded.period_end, computed_at = now();
    end if;

    if v_occupancy is not null then
      insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
      values ('occupancy_rate', 'clinica', clinic_row.id, period_start, period_end, v_occupancy)
      on conflict (metric_key, scope_type, scope_id, period_start)
      do update set value = excluded.value, period_end = excluded.period_end, computed_at = now();
    end if;

    -- glosa_rate (§10.4): valor glosado ÷ faturado nas competências deste
    -- mês, para convênios desta clínica.
    select
      coalesce(sum(bi.amount), 0),
      coalesce(sum(bi.amount) filter (where bi.status = 'glosado'), 0)
    into billed_total, billed_glosado
    from billing_items bi
    join billing_periods bp on bp.id = bi.billing_period_id
    join insurers i on i.id = bp.insurer_id
    where i.clinic_id = clinic_row.id
      and bp.competence_month = period_start;

    if billed_total > 0 then
      v_glosa := billed_glosado / billed_total;
      insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
      values ('glosa_rate', 'clinica', clinic_row.id, period_start, period_end, v_glosa)
      on conflict (metric_key, scope_type, scope_id, period_start)
      do update set value = excluded.value, period_end = excluded.period_end, computed_at = now();
    end if;

  end loop;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'close_monthly_metric_snapshots',
    '0 3 1 * *',
    $job$select close_monthly_metric_snapshots();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende close_monthly_metric_snapshots() externamente. %', sqlerrm;
end;
$$;
