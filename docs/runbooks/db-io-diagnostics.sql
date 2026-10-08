-- docs/runbooks/db-io-diagnostics.sql
-- SOMENTE LEITURA. Rode query por query no SQL Editor (nada aqui altera dados).
-- Banco compartilhado com outro app: filtre pelo schema/tabelas deste sistema.

-- 1) Recorrências com mais sessões / horizonte mais distante (detecta o runaway
--    de regenerate_active_grade_sessions). Esperado: max_starts_at <= hoje + ~8 semanas.
select recurrence_id,
       count(*)                                                        as sessoes,
       count(*) filter (where starts_at > now())                       as futuras,
       min(starts_at)                                                  as primeira,
       max(starts_at)                                                  as max_starts_at,
       round(extract(epoch from (max(starts_at) - now())) / 604800, 1) as semanas_a_frente
from public.appointments
where recurrence_id is not null
  and status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
group by recurrence_id
order by max(starts_at) desc
limit 50;

-- 1b) Distribuição geral do horizonte (quantas séries por faixa de semanas à frente).
select width_bucket(extract(epoch from (mx - now())) / 604800, 0, 60, 12) as faixa_5_semanas,
       count(*) as series
from (select recurrence_id, max(starts_at) mx
      from public.appointments
      where recurrence_id is not null
        and status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
      group by recurrence_id) s
group by 1 order by 1;

-- 2) audit_log: linhas por tabela nas últimas 24h.
select table_name, action, count(*) as linhas
from public.audit_log
where at > now() - interval '24 hours'
group by 1, 2
order by linhas desc;

-- 2b) Total e idade do audit_log.
select count(*) as total, min(at) as mais_antigo, max(at) as mais_recente,
       count(*) filter (where at < now() - interval '365 days') as mais_de_365d
from public.audit_log;

-- 3) Tamanho das maiores tabelas (total, heap, índices, TOAST).
select n.nspname as schema, c.relname as tabela,
       pg_size_pretty(pg_total_relation_size(c.oid))                                  as total,
       pg_size_pretty(pg_relation_size(c.oid))                                        as heap,
       pg_size_pretty(pg_indexes_size(c.oid))                                         as indices,
       pg_size_pretty(coalesce(pg_total_relation_size(c.reltoastrelid), 0))           as toast,
       c.reltuples::bigint                                                            as linhas_estimadas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public', 'cron', 'net', 'storage', 'auth')
order by pg_total_relation_size(c.oid) desc
limit 25;

-- 4) pg_stat_statements: top por blocos lidos do disco (requer a extensão).
select left(query, 120)                                  as query,
       calls,
       shared_blks_read,
       shared_blks_hit,
       round(total_exec_time::numeric / 1000, 1)         as total_s,
       round(mean_exec_time::numeric, 2)                 as mean_ms,
       rows
from pg_stat_statements
order by shared_blks_read desc
limit 20;

-- 5) Jobs de pg_cron (frequência, ativo, nome) e execuções recentes.
select jobid, jobname, schedule, active, left(command, 80) as comando
from cron.job
order by jobid;

select j.jobname, d.status, count(*) as execucoes, max(d.start_time) as ultima
from cron.job_run_details d
join cron.job j using (jobid)
where d.start_time > now() - interval '24 hours'
group by 1, 2
order by execucoes desc;

select count(*) as linhas, pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as tamanho
from cron.job_run_details;

select count(*) as linhas, pg_size_pretty(pg_total_relation_size('net._http_response')) as tamanho
from net._http_response;

-- 6) Cache hit ratio (alvo > 99% em tabelas e índices).
select 'tabelas' as tipo,
       round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0), 2) as hit_pct
from pg_statio_user_tables
union all
select 'indices',
       round(100.0 * sum(idx_blks_hit) / nullif(sum(idx_blks_hit + idx_blks_read), 0), 2)
from pg_statio_user_indexes;

-- 7) Seq scans em tabelas grandes (confirma a falta de índice em appointments).
select relname, seq_scan, seq_tup_read, idx_scan, n_live_tup, n_dead_tup
from pg_stat_user_tables
where schemaname = 'public'
order by seq_tup_read desc
limit 15;
