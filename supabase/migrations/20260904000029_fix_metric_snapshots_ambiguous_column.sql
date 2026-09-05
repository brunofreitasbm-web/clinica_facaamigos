-- supabase/migrations/20260904000029_fix_metric_snapshots_ambiguous_column.sql
--
-- Bug encontrado ao validar 000027 contra o banco real: as variáveis
-- PL/pgSQL `period_start`/`period_end` têm o mesmo nome das colunas de
-- `metric_snapshots`, o que o Postgres aceita na lista de VALUES (resolve
-- pra variável) mas rejeita como ambíguo na lista de colunas do ON CONFLICT
-- (`column reference "period_start" is ambiguous`). Renomeia as variáveis
-- pra v_period_start/v_period_end pra nunca colidir com nome de coluna.
-- Validado contra o banco real (inserção de dataset controlado + rollback)
-- antes desta migration: no_show_rate, occupancy_rate e glosa_rate batem
-- com o esperado, e rodar a função 2x não duplica linha.
create or replace function close_monthly_metric_snapshots() returns void
language plpgsql security definer set search_path = public as $$
declare
  clinic_row record;
  v_period_start date := date_trunc('month', now() - interval '1 month')::date;
  v_period_end date := date_trunc('month', now())::date;
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
      and a.starts_at >= v_period_start and a.starts_at < v_period_end;

    v_occupancy := case when scheduled_hours > 0 then realized_hours / scheduled_hours else null end;
    v_no_show := case when denom_count > 0 then falta_count::numeric / denom_count else null end;

    if v_no_show is not null then
      insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
      values ('no_show_rate', 'clinica', clinic_row.id, v_period_start, v_period_end, v_no_show)
      on conflict (metric_key, scope_type, scope_id, period_start)
      do update set value = excluded.value, period_end = excluded.period_end, computed_at = now();
    end if;

    if v_occupancy is not null then
      insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
      values ('occupancy_rate', 'clinica', clinic_row.id, v_period_start, v_period_end, v_occupancy)
      on conflict (metric_key, scope_type, scope_id, period_start)
      do update set value = excluded.value, period_end = excluded.period_end, computed_at = now();
    end if;

    select
      coalesce(sum(bi.amount), 0),
      coalesce(sum(bi.amount) filter (where bi.status = 'glosado'), 0)
    into billed_total, billed_glosado
    from billing_items bi
    join billing_periods bp on bp.id = bi.billing_period_id
    join insurers i on i.id = bp.insurer_id
    where i.clinic_id = clinic_row.id
      and bp.competence_month = v_period_start;

    if billed_total > 0 then
      v_glosa := billed_glosado / billed_total;
      insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
      values ('glosa_rate', 'clinica', clinic_row.id, v_period_start, v_period_end, v_glosa)
      on conflict (metric_key, scope_type, scope_id, period_start)
      do update set value = excluded.value, period_end = excluded.period_end, computed_at = now();
    end if;

  end loop;
end;
$$;

revoke execute on function close_monthly_metric_snapshots() from public, anon, authenticated;
