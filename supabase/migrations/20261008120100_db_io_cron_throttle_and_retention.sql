-- supabase/migrations/20261008120100_db_io_cron_throttle_and_retention.sql
--
-- Incidente de Disk I/O (2026-10-08). Duas frentes:
--  1) process_registration_drafts / process_insurance_intake: de a cada minuto
--     (1.440 chamadas HTTP/dia cada, quase todas vazias) para a cada 5 min.
--  2) Retenção diária (07:00 UTC = 04:00 BRT) de dados de log que cresciam sem limite.
--
-- Retenção de audit_log: nenhum prazo está documentado em docs/ ou nas
-- migrations (só há "LGPD: não guardar mais do que o necessário" para ux_events,
-- 180 dias). Adotado 365 dias para audit_log — as métricas que leem audit_log
-- usam janelas de 50/90 dias. Se houver exigência legal maior, AJUSTE
-- p_audit_days na função/cron antes de aplicar. O log de acesso a prontuário
-- (record_access_log, LGPD) NÃO é tocado.

-- 1) Frequência dos jobs -----------------------------------------------------
-- cron.alter_job só troca o schedule: o comando (net.http_post com o segredo
-- lido do Vault, definido em 20260921040000) permanece intacto. Resolvido por
-- NOME, não por id fixo.
do $$
declare
  j record;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — nada a reagendar.';
    return;
  end if;
  for j in
    select jobid, jobname from cron.job
    where jobname in ('process_registration_drafts', 'process_insurance_intake')
  loop
    perform cron.alter_job(job_id := j.jobid, schedule := '*/5 * * * *');
  end loop;
exception when others then
  raise notice 'não foi possível reagendar jobs de extração/intake: %', sqlerrm;
end;
$$;

-- 2) Função de retenção ------------------------------------------------------
create or replace function maintenance_purge_old_data(
  p_audit_days int default 365,
  p_audit_batch int default 10000,
  p_ux_days int default 180,
  p_cron_days int default 3,
  p_net_days int default 3
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n bigint;
  result jsonb := '{}'::jsonb;
begin
  -- audit_log: em lotes (limite por execução) para não gerar pico de WAL/I-O.
  begin
    delete from audit_log
    where id in (
      select id from audit_log
      where at < now() - make_interval(days => p_audit_days)
      order by at
      limit p_audit_batch
    );
    get diagnostics n = row_count;
    result := result || jsonb_build_object('audit_log', n);
  exception when others then
    raise warning 'maintenance_purge_old_data audit_log: %', sqlerrm;
  end;

  begin
    if to_regprocedure('purge_ux_events(integer)') is not null then
      result := result || jsonb_build_object('ux_events', purge_ux_events(p_ux_days));
    end if;
  exception when others then
    raise warning 'maintenance_purge_old_data ux_events: %', sqlerrm;
  end;

  begin
    if to_regclass('cron.job_run_details') is not null then
      execute format(
        'delete from cron.job_run_details where end_time < now() - make_interval(days => %s)',
        p_cron_days::int
      );
      get diagnostics n = row_count;
      result := result || jsonb_build_object('cron_job_run_details', n);
    end if;
  exception when others then
    raise warning 'maintenance_purge_old_data cron.job_run_details: %', sqlerrm;
  end;

  begin
    if to_regclass('net._http_response') is not null then
      execute format(
        'delete from net._http_response where created < now() - make_interval(days => %s)',
        p_net_days::int
      );
      get diagnostics n = row_count;
      result := result || jsonb_build_object('net_http_response', n);
    end if;
  exception when others then
    raise warning 'maintenance_purge_old_data net._http_response: %', sqlerrm;
  end;

  return result;
end;
$$;

revoke all on function maintenance_purge_old_data(int, int, int, int, int) from public, anon, authenticated;

-- 3) Agendamento diário ------------------------------------------------------
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — agende select maintenance_purge_old_data() externamente.';
    return;
  end if;
  -- cron.schedule com o mesmo nome substitui (idempotente).
  perform cron.schedule(
    'db_retention_daily',
    '0 7 * * *',
    $job$select maintenance_purge_old_data();$job$
  );
exception when others then
  raise notice 'não foi possível agendar db_retention_daily: %', sqlerrm;
end;
$$;
