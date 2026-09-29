-- supabase/migrations/20260929000000_ux_friction_events.sql
-- Monitor de fricção de uso: onde o operador hesita, erra, clica sem resposta
-- ou se perde procurando uma ferramenta. Coletado por components/friction-tracker.tsx
-- e gravado por app/api/ux-events (service role, como `ai_usage_log`).
--
-- PRIVACIDADE: a tabela guarda só tela (ids trocados por ":id"), tipo de sinal,
-- rótulo curto de botão (sem e-mail/números longos) e tempos/contagens. Nunca
-- valores digitados nem nome de paciente. Só o gestor lê. Retenção: ver
-- `purge_ux_events` no fim.
--
-- Views do METABASE seguem o padrão de 20260918_metabase_bi_views: security_invoker,
-- e TODO indicador traz o comparativo (semana anterior) e a meta (AGENTS.md).
-- As metas são PREMISSAS iniciais — ajustar conforme a clínica for medindo.
-- Cada view tem uma coluna `leitura` em português simples para quem não é técnico.

-- =====================================================================
-- 1. Eventos
-- =====================================================================
create table ux_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  role text not null,
  -- Aba do navegador (uuid aleatório em sessionStorage): agrupa "uma sentada de uso".
  session_id text not null,
  route text not null,
  event_type text not null check (event_type in ('page_view', 'rage_click', 'dead_click', 'form_error', 'ui_error')),
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ux_events_clinic_created_idx on ux_events (clinic_id, created_at desc);
create index ux_events_route_idx on ux_events (clinic_id, route, event_type, created_at desc);
create index ux_events_session_idx on ux_events (session_id, created_at);

alter table ux_events enable row level security;

-- Sem policy de INSERT de propósito: só o servidor (service role) grava.
create policy ux_events_read on ux_events for select
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor'));

-- =====================================================================
-- 2. KPI geral por semana e por papel (Recepção, Terapeuta... + "todos")
-- =====================================================================
create or replace view metabase_ux_friction_kpis with (security_invoker = true) as
with ev as (
  select
    clinic_id, profile_id, role, session_id, event_type, detail,
    date_trunc('week', created_at at time zone 'America/Belem')::date as semana
  from ux_events
),
sess as (
  select
    clinic_id, semana, role, session_id,
    bool_or(event_type <> 'page_view') as teve_friccao
  from ev
  group by clinic_id, semana, role, session_id
),
agg as (
  select
    clinic_id, semana, coalesce(role, 'todos') as papel,
    count(*) filter (where event_type = 'page_view') as telas_vistas,
    count(*) filter (where event_type <> 'page_view') as sinais,
    count(distinct profile_id) as usuarios_ativos,
    percentile_cont(0.5) within group (order by (detail ->> 'ttfa_ms')::numeric)
      filter (where event_type = 'page_view' and detail ? 'ttfa_ms') as ttfa_mediano_ms
  from ev
  group by grouping sets ((clinic_id, semana, role), (clinic_id, semana))
),
sess_agg as (
  select
    clinic_id, semana, coalesce(role, 'todos') as papel,
    count(*) as sessoes,
    count(*) filter (where teve_friccao) as sessoes_com_friccao
  from sess
  group by grouping sets ((clinic_id, semana, role), (clinic_id, semana))
),
base as (
  select
    a.clinic_id, a.semana, a.papel, a.telas_vistas, a.sinais, a.usuarios_ativos,
    s.sessoes, s.sessoes_com_friccao,
    round(100.0 * s.sessoes_com_friccao / nullif(s.sessoes, 0), 2) as pct_sessoes_com_friccao,
    round(100.0 * a.sinais / nullif(a.telas_vistas, 0), 2) as sinais_por_100_telas,
    round((a.ttfa_mediano_ms / 1000.0)::numeric, 1) as ttfa_mediano_s
  from agg a
  join sess_agg s using (clinic_id, semana, papel)
)
select
  b.clinic_id,
  b.semana,
  (b.semana = date_trunc('week', now() at time zone 'America/Belem')::date) as semana_em_andamento,
  b.papel,
  b.usuarios_ativos,
  b.sessoes,
  b.telas_vistas,
  b.sessoes_com_friccao,
  b.pct_sessoes_com_friccao as pct_sessoes_com_friccao_atual,
  p.pct_sessoes_com_friccao as pct_sessoes_com_friccao_semana_anterior,
  round(b.pct_sessoes_com_friccao - p.pct_sessoes_com_friccao, 2) as variacao_pp,
  15.00 as meta_max_pct_sessoes_com_friccao,
  b.sinais_por_100_telas as sinais_por_100_telas_atual,
  p.sinais_por_100_telas as sinais_por_100_telas_semana_anterior,
  5.00 as meta_max_sinais_por_100_telas,
  b.ttfa_mediano_s as ttfa_mediano_atual_s,
  p.ttfa_mediano_s as ttfa_mediano_semana_anterior_s,
  10.0 as meta_max_ttfa_s,
  case
    when b.telas_vistas < 30 then 'Poucos dados nesta semana: ainda não dá para tirar conclusão.'
    when p.semana is null then 'Primeira semana com dados: ainda não existe comparação.'
    when b.pct_sessoes_com_friccao > 15 and b.pct_sessoes_com_friccao > p.pct_sessoes_com_friccao
      then 'Atenção: mais gente está tropeçando no sistema do que na semana passada e já passou da meta.'
    when b.pct_sessoes_com_friccao > 15
      then 'Acima da meta, mas melhorando ou estável: vale olhar as telas com mais tropeços.'
    when b.pct_sessoes_com_friccao > p.pct_sessoes_com_friccao
      then 'Dentro da meta, mas piorou em relação à semana passada: acompanhar.'
    else 'Bom: dentro da meta e igual ou melhor que a semana passada.'
  end as leitura
from base b
left join base p
  on p.clinic_id = b.clinic_id and p.papel = b.papel and p.semana = b.semana - 7;

-- =====================================================================
-- 3. Por tela: onde tropeçam, hesitam ou saem correndo
-- =====================================================================
create or replace view metabase_ux_friction_by_page with (security_invoker = true) as
with ev as (
  select
    clinic_id, profile_id, role, route, event_type, detail,
    date_trunc('week', created_at at time zone 'America/Belem')::date as semana
  from ux_events
),
agg as (
  select
    clinic_id, semana, route,
    count(*) filter (where event_type = 'page_view') as visualizacoes,
    count(distinct profile_id) as usuarios_distintos,
    string_agg(distinct role, ', ') as papeis,
    count(*) filter (where event_type = 'rage_click') as cliques_repetidos,
    count(*) filter (where event_type = 'dead_click') as cliques_sem_resposta,
    count(*) filter (where event_type = 'form_error') as erros_formulario,
    count(*) filter (where event_type = 'ui_error') as erros_sistema,
    count(*) filter (where event_type <> 'page_view') as sinais,
    count(*) filter (where event_type = 'page_view' and (detail ->> 'dwell_ms')::numeric < 5000) as saidas_rapidas,
    percentile_cont(0.5) within group (order by (detail ->> 'dwell_ms')::numeric)
      filter (where event_type = 'page_view') as permanencia_mediana_ms,
    percentile_cont(0.5) within group (order by (detail ->> 'ttfa_ms')::numeric)
      filter (where event_type = 'page_view' and detail ? 'ttfa_ms') as ttfa_mediano_ms
  from ev
  group by clinic_id, semana, route
),
base as (
  select
    a.*,
    round(100.0 * a.sinais / nullif(a.visualizacoes, 0), 2) as sinais_por_100_visualizacoes,
    round(100.0 * a.saidas_rapidas / nullif(a.visualizacoes, 0), 2) as pct_saidas_rapidas,
    round((a.permanencia_mediana_ms / 1000.0)::numeric, 1) as permanencia_mediana_s,
    round((a.ttfa_mediano_ms / 1000.0)::numeric, 1) as ttfa_mediano_s
  from agg a
)
select
  b.clinic_id,
  b.semana,
  b.route as tela,
  b.papeis,
  b.usuarios_distintos,
  b.visualizacoes,
  b.cliques_repetidos,
  b.cliques_sem_resposta,
  b.erros_formulario,
  b.erros_sistema,
  b.sinais,
  row_number() over (partition by b.clinic_id, b.semana order by b.sinais desc, b.visualizacoes desc) as prioridade,
  b.sinais_por_100_visualizacoes as sinais_por_100_atual,
  p.sinais_por_100_visualizacoes as sinais_por_100_semana_anterior,
  round(b.sinais_por_100_visualizacoes - p.sinais_por_100_visualizacoes, 2) as variacao_sinais_pp,
  5.00 as meta_max_sinais_por_100,
  b.pct_saidas_rapidas as pct_saidas_rapidas_atual,
  p.pct_saidas_rapidas as pct_saidas_rapidas_semana_anterior,
  25.00 as meta_max_pct_saidas_rapidas,
  b.ttfa_mediano_s as ttfa_mediano_atual_s,
  p.ttfa_mediano_s as ttfa_mediano_semana_anterior_s,
  10.0 as meta_max_ttfa_s,
  b.permanencia_mediana_s,
  case
    when b.sinais = 0 and not (b.visualizacoes >= 10 and (b.pct_saidas_rapidas >= 40 or b.ttfa_mediano_s >= 15))
      then 'Sem sinal de dificuldade nesta tela.'
    else concat_ws(' ',
      case when b.cliques_repetidos >= 3 then 'Cliques repetidos: alguma coisa nesta tela parece não responder ao clique.' end,
      case when b.cliques_sem_resposta >= 3 then 'Cliques sem efeito: existe botão ou área que parece clicável mas não faz nada.' end,
      case when b.erros_formulario >= 3 then 'Formulário barrando o envio várias vezes: campo obrigatório pouco visível ou instrução confusa.' end,
      case when b.erros_sistema >= 3 then 'O sistema mostrou erro várias vezes nesta tela: pode ser defeito, não dificuldade de uso.' end,
      case when b.visualizacoes >= 10 and b.pct_saidas_rapidas >= 40 then 'Muita gente sai em poucos segundos: talvez o caminho até aqui esteja confuso e chegaram na tela errada.' end,
      case when b.visualizacoes >= 10 and b.ttfa_mediano_s >= 15 then 'Demoram para agir depois de abrir a tela: hesitação, muita informação ou falta de um destaque claro.' end,
      case when b.sinais > 0 and b.sinais < 3 and b.cliques_repetidos < 3 and b.cliques_sem_resposta < 3
                and b.erros_formulario < 3 and b.erros_sistema < 3 then 'Poucos sinais isolados: acompanhar, sem urgência.' end
    )
  end as leitura
from base b
left join base p
  on p.clinic_id = b.clinic_id and p.route = b.route and p.semana = b.semana - 7;

-- =====================================================================
-- 4. Por botão/área: "aquele botão que não funciona"
-- =====================================================================
create or replace view metabase_ux_friction_by_element with (security_invoker = true) as
with ev as (
  select
    clinic_id, profile_id, route, event_type, coalesce(target, '(sem rótulo)') as elemento,
    date_trunc('week', created_at at time zone 'America/Belem')::date as semana
  from ux_events
  where event_type in ('rage_click', 'dead_click')
),
base as (
  select
    clinic_id, semana, route, elemento, event_type,
    count(*) as ocorrencias,
    count(distinct profile_id) as usuarios_distintos
  from ev
  group by clinic_id, semana, route, elemento, event_type
)
select
  b.clinic_id,
  b.semana,
  b.route as tela,
  b.elemento,
  case b.event_type when 'rage_click' then 'Cliques repetidos' else 'Clique sem resposta' end as tipo,
  b.usuarios_distintos,
  b.ocorrencias as ocorrencias_atual,
  coalesce(p.ocorrencias, 0) as ocorrencias_semana_anterior,
  b.ocorrencias - coalesce(p.ocorrencias, 0) as variacao_absoluta,
  2 as meta_max_ocorrencias,
  case
    when b.ocorrencias < 3 then 'Poucas ocorrências: acompanhar.'
    when b.usuarios_distintos >= 2 and b.event_type = 'dead_click'
      then 'Mais de uma pessoa clicou e nada aconteceu: provável botão quebrado ou que parece clicável sem ser.'
    when b.usuarios_distintos >= 2
      then 'Mais de uma pessoa clicou várias vezes seguidas: a resposta demora ou não fica visível (falta de aviso "salvando...").'
    when b.event_type = 'dead_click'
      then 'Uma pessoa clicou várias vezes sem efeito: pode ser dúvida individual ou botão sem função.'
    else 'Uma pessoa clicou várias vezes seguidas: pode ser lentidão ou impaciência individual.'
  end as leitura
from base b
left join base p
  on p.clinic_id = b.clinic_id and p.route = b.route and p.elemento = b.elemento
     and p.event_type = b.event_type and p.semana = b.semana - 7;

-- =====================================================================
-- 5. Vai-e-volta: "abri a tela errada" (dificuldade de achar a ferramenta)
--    Padrão: tela A -> tela B (menos de 15 s) -> de volta à tela A.
-- =====================================================================
create or replace view metabase_ux_navigation_loops with (security_invoker = true) as
with pv as (
  select
    clinic_id, profile_id, session_id, route, created_at,
    (detail ->> 'dwell_ms')::numeric as dwell_ms,
    lag(route) over w as rota_anterior,
    lead(route) over w as rota_seguinte
  from ux_events
  where event_type = 'page_view'
  window w as (partition by session_id order by created_at)
),
loops as (
  select
    clinic_id, profile_id,
    date_trunc('week', created_at at time zone 'America/Belem')::date as semana,
    rota_anterior as tela_de_origem,
    route as tela_visitada
  from pv
  where rota_anterior is not null
    and rota_anterior = rota_seguinte
    and route <> rota_anterior
    and dwell_ms < 15000
),
base as (
  select
    clinic_id, semana, tela_de_origem, tela_visitada,
    count(*) as idas_e_voltas,
    count(distinct profile_id) as usuarios_distintos
  from loops
  group by clinic_id, semana, tela_de_origem, tela_visitada
)
select
  b.clinic_id,
  b.semana,
  b.tela_de_origem,
  b.tela_visitada,
  b.usuarios_distintos,
  b.idas_e_voltas as idas_e_voltas_atual,
  coalesce(p.idas_e_voltas, 0) as idas_e_voltas_semana_anterior,
  b.idas_e_voltas - coalesce(p.idas_e_voltas, 0) as variacao_absoluta,
  3 as meta_max_idas_e_voltas,
  case
    when b.idas_e_voltas < 3 then 'Poucas ocorrências: acompanhar.'
    when b.usuarios_distintos >= 2
      then 'Várias pessoas saem de "' || b.tela_de_origem || '", abrem "' || b.tela_visitada
           || '" e voltam em segundos: o nome ou o lugar deste atalho está levando ao destino errado.'
    else 'Uma pessoa repete o vai-e-volta entre estas telas: pode ser dúvida individual; vale conversar com ela.'
  end as leitura
from base b
left join base p
  on p.clinic_id = b.clinic_id and p.tela_de_origem = b.tela_de_origem
     and p.tela_visitada = b.tela_visitada and p.semana = b.semana - 7;

-- =====================================================================
-- 6. Retenção (LGPD: não guardar mais do que o necessário)
--    Rodar de tempos em tempos (Supabase > Database > Cron):
--      select purge_ux_events(180);
-- =====================================================================
create or replace function purge_ux_events(keep_days integer default 180)
returns integer
language sql
as $$
  with d as (
    delete from ux_events where created_at < now() - make_interval(days => keep_days) returning 1
  )
  select count(*)::integer from d;
$$;

revoke all on function purge_ux_events(integer) from public, anon, authenticated;
