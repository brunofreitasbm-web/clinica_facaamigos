-- supabase/migrations/20260906000017_glosa_recurring_patterns.sql
-- Fecha o loop entre glosa registrada e prevenção futura: hoje
-- lib/glosa-analytics.ts só mostra histórico agrupado (§9.8/§10.4) — cada
-- glosa nova repete um motivo que já aconteceu antes sem que o sistema
-- "aprenda" nada com isso. Esta tabela é estritamente analítica: guarda só
-- CONTAGENS/METADADOS agregados por convênio+motivo (nunca valores em
-- dinheiro), e é aditiva/somente-leitura sobre `glosas`/`billing_items`/
-- `billing_periods` — não altera nenhuma linha financeira existente.
--
-- Mesmo desenho de absence_alerts (20260906000015) e reassessment_alerts
-- (20260904000019): tabela de alerta + função de recálculo security
-- definer agendada via pg_cron.

create table glosa_recurring_patterns (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id),
  reason_code text not null,
  occurrences_count int not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  status text not null default 'ativo' check (status in ('ativo','reconhecido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (insurer_id, reason_code)
);

-- Índice parcial: só o que o painel (destaque no topo de
-- app/faturamento/glosas) e a futura pré-validação de faturamento
-- precisam varrer.
create index glosa_recurring_patterns_active_idx on glosa_recurring_patterns (insurer_id, reason_code) where status = 'ativo';

alter table glosa_recurring_patterns enable row level security;

-- Mesmo escopo de papel/clínica de glosas_read (gestor/faturamento, join
-- até clinic_id via insurers) — esta tabela não tem attributable_to então
-- não existe o "OR terapeuta vê a própria glosa" de glosas_read.
create policy glosa_recurring_patterns_read on glosa_recurring_patterns for select
  using (
    app_current_role() in ('gestor','faturamento')
    and exists (
      select 1 from insurers i
      where i.id = glosa_recurring_patterns.insurer_id and i.clinic_id = current_clinic_id()
    )
  );

-- Único campo editável pela aplicação é `status` (reconhecer o padrão como
-- "já estamos cientes, tratando"). occurrences_count/first_seen_at/
-- last_seen_at são geridos só pela rotina abaixo, mesmo espírito de
-- reassessment_alerts_update (só a transição manual tem policy de update).
create policy glosa_recurring_patterns_update on glosa_recurring_patterns for update
  using (
    app_current_role() in ('gestor','faturamento')
    and exists (
      select 1 from insurers i
      where i.id = glosa_recurring_patterns.insurer_id and i.clinic_id = current_clinic_id()
    )
  );

-- security definer (mesmo padrão de refresh_absence_alerts/
-- refresh_reassessment_alerts): recalcula a partir de `glosas` real, com
-- LEITURA apenas em glosas/billing_items/billing_periods/insurers — nenhum
-- insert/update/delete nessas tabelas. A única escrita é em
-- glosa_recurring_patterns (contagens/metadados, sem valor monetário).
--
-- Limiar: 3 ocorrências do mesmo convênio+motivo nos últimos 6 meses —
-- mesma ordem de grandeza do limiar de faltas repetidas em
-- absence_alerts (patient_absence_stats: 3 faltas consecutivas). A "data"
-- de uma glosa é aproximada por billing_periods.competence_month, já que
-- `glosas`/`billing_items` não têm coluna de timestamp de criação (mesma
-- limitação documentada em app/faturamento/glosas/page.tsx).
create function refresh_glosa_patterns() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_upserted int := 0;
begin
  with qualifying as (
    select
      i.id as insurer_id,
      g.reason_code,
      count(*) as occurrences_count,
      min(bp.competence_month)::timestamptz as first_seen_at,
      max(bp.competence_month)::timestamptz as last_seen_at
    from glosas g
    join billing_items bi on bi.id = g.billing_item_id
    join billing_periods bp on bp.id = bi.billing_period_id
    join insurers i on i.id = bp.insurer_id
    where bp.competence_month >= (current_date - interval '6 months')::date
    group by i.id, g.reason_code
    having count(*) >= 3
  ),
  upsert as (
    insert into glosa_recurring_patterns (insurer_id, reason_code, occurrences_count, first_seen_at, last_seen_at)
    select insurer_id, reason_code, occurrences_count, first_seen_at, last_seen_at from qualifying
    on conflict (insurer_id, reason_code) do update
      set occurrences_count = excluded.occurrences_count,
          first_seen_at = excluded.first_seen_at,
          last_seen_at = excluded.last_seen_at,
          updated_at = now()
      -- status não é tocado aqui: se a equipe já marcou 'reconhecido', uma
      -- nova execução do cron (mais ocorrências) não reabre sozinho — é
      -- uma decisão manual, mesmo espírito de reassessment_alerts_update.
    returning 1
  )
  select count(*) into v_upserted from upsert;

  -- Remove padrões que deixaram de bater o limiar (janela de 6 meses
  -- avançou e as ocorrências saíram dela) — não há valor em manter
  -- metadado de recorrência que não é mais real.
  delete from glosa_recurring_patterns grp
  where not exists (
    select 1
    from glosas g
    join billing_items bi on bi.id = g.billing_item_id
    join billing_periods bp on bp.id = bi.billing_period_id
    where bp.insurer_id = grp.insurer_id
      and g.reason_code = grp.reason_code
      and bp.competence_month >= (current_date - interval '6 months')::date
    group by bp.insurer_id, g.reason_code
    having count(*) >= 3
  );

  return v_upserted;
end;
$$;

revoke execute on function refresh_glosa_patterns() from public, anon, authenticated;

-- Agendamento diário, mesmo padrão de refresh_reassessment_alerts_daily
-- (roda direto via cron.schedule, sem pg_net, pois não há disparo externo
-- de notificação aqui — é só recálculo do painel).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'refresh_glosa_patterns_daily',
    '0 6 * * *',
    $job$select refresh_glosa_patterns();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende refresh_glosa_patterns() externamente. %', sqlerrm;
end;
$$;
