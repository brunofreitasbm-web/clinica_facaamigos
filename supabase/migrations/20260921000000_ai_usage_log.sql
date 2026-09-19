-- supabase/migrations/20260921000000_ai_usage_log.sql
-- Custo com IA (Gemini + Claude): registro de cada chamada, tabela de preços
-- e views do Metabase com meta (orçamento) + mês anterior (AGENTS.md: todo KPI
-- precisa de comparativo).
--
-- `ai_usage_log` é gravada só pelo servidor (service role, lib/ai-usage.ts) a
-- partir do `usageMetadata` do Gemini e do `usage` da Anthropic. Nenhuma
-- policy de INSERT de propósito: a chave anon/authenticated nunca escreve nela.
-- O custo NÃO é gravado por linha — é calculado nas views a partir de
-- `ai_model_prices`, então corrigir um preço reprocessa o histórico inteiro.

-- =====================================================================
-- 1. Registro de uso
-- =====================================================================
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'anthropic')),
  model text not null,
  feature text not null,
  input_tokens integer not null default 0,
  -- Subconjunto de input_tokens que foi áudio (preço por modalidade).
  audio_input_tokens integer not null default 0,
  -- Gemini: candidatesTokenCount. Anthropic: output_tokens (já inclui thinking).
  output_tokens integer not null default 0,
  -- Gemini: thoughtsTokenCount — cobrado como saída, mas vem separado.
  thinking_tokens integer not null default 0,
  http_status integer,
  success boolean not null default true,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index ai_usage_log_clinic_created_idx on ai_usage_log (clinic_id, created_at desc);
create index ai_usage_log_feature_idx on ai_usage_log (clinic_id, feature, created_at desc);

alter table ai_usage_log enable row level security;

create policy ai_usage_log_read on ai_usage_log for select
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor'));

-- =====================================================================
-- 2. Preços por modelo (USD por 1 milhão de tokens)
-- =====================================================================
create table ai_model_prices (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini', 'anthropic')),
  model text not null,
  usd_per_m_input numeric(10, 4) not null,
  usd_per_m_output numeric(10, 4) not null,
  -- Null = áudio cobra o mesmo preço do texto.
  usd_per_m_audio_input numeric(10, 4),
  vigente_desde date not null default current_date,
  fonte text,
  unique (provider, model, vigente_desde)
);

alter table ai_model_prices enable row level security;

create policy ai_model_prices_read on ai_model_prices for select
  using ((select app_current_role()) in ('gestor'));
create policy ai_model_prices_manage on ai_model_prices for all
  using ((select app_current_role()) in ('gestor'))
  with check ((select app_current_role()) in ('gestor'));

insert into ai_model_prices (provider, model, usd_per_m_input, usd_per_m_output, usd_per_m_audio_input, vigente_desde, fonte)
values
  ('gemini', 'gemini-3.5-flash-lite', 0.30, 2.50, 0.30, '2026-01-01',
   'https://ai.google.dev/gemini-api/docs/pricing (tier pago, conferido em 2026-09-19)'),
  ('anthropic', 'claude-sonnet-5', 2.00, 10.00, null, '2026-01-01',
   'Tabela de preços da Anthropic (cache local de 2026-06-24) — conferir');

-- =====================================================================
-- 3. Câmbio e orçamento (a "meta" do KPI de custo)
-- =====================================================================
create table ai_cost_settings (
  clinic_id uuid primary key references clinics(id) on delete cascade,
  usd_brl numeric(8, 4) not null default 5.50 check (usd_brl > 0),
  monthly_budget_brl numeric(10, 2) not null default 50.00 check (monthly_budget_brl > 0),
  updated_at timestamptz not null default now()
);

alter table ai_cost_settings enable row level security;

create policy ai_cost_settings_read on ai_cost_settings for select
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor'));
create policy ai_cost_settings_manage on ai_cost_settings for all
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor'))
  with check (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor'));

-- Câmbio e orçamento INICIAIS são premissas — ajustar em ai_cost_settings.
insert into ai_cost_settings (clinic_id)
select id from clinics
on conflict do nothing;

-- =====================================================================
-- 4. Views do Metabase (security_invoker, padrão de 20260918_metabase_bi_views)
-- =====================================================================
create or replace view metabase_ai_usage_detail with (security_invoker = true) as
select
  u.id as usage_id,
  u.clinic_id,
  to_char(u.created_at at time zone 'America/Belem', 'YYYY-MM') as mes,
  (u.created_at at time zone 'America/Belem')::date as dia,
  u.created_at,
  u.provider,
  u.model,
  u.feature,
  u.input_tokens,
  u.audio_input_tokens,
  u.output_tokens,
  u.thinking_tokens,
  u.success,
  u.http_status,
  u.latency_ms,
  c.custo_usd,
  round(c.custo_usd * coalesce(s.usd_brl, 5.50), 6) as custo_brl,
  (p.usd_per_m_input is null) as sem_preco_cadastrado
from ai_usage_log u
left join lateral (
  select * from ai_model_prices p
  where p.provider = u.provider and p.model = u.model and p.vigente_desde <= (u.created_at at time zone 'America/Belem')::date
  order by p.vigente_desde desc
  limit 1
) p on true
left join ai_cost_settings s on s.clinic_id = u.clinic_id
cross join lateral (
  select
    (greatest(u.input_tokens - u.audio_input_tokens, 0) * coalesce(p.usd_per_m_input, 0)
     + u.audio_input_tokens * coalesce(p.usd_per_m_audio_input, p.usd_per_m_input, 0)
     + (u.output_tokens + u.thinking_tokens) * coalesce(p.usd_per_m_output, 0)
    ) / 1000000.0 as custo_usd
) c;

create or replace view metabase_ai_cost_kpis with (security_invoker = true) as
with agg as (
  select
    d.clinic_id,
    d.mes,
    count(*) as chamadas,
    count(*) filter (where not d.success) as chamadas_com_erro,
    sum(d.input_tokens) as tokens_entrada,
    sum(d.output_tokens + d.thinking_tokens) as tokens_saida,
    sum(d.custo_brl) as custo_brl,
    count(*) filter (where d.sem_preco_cadastrado) as chamadas_sem_preco
  from metabase_ai_usage_detail d
  group by d.clinic_id, d.mes
),
atend as (
  select clinic_id,
         to_char(opened_at at time zone 'America/Belem', 'YYYY-MM') as mes,
         count(*) as atendimentos
  from conversation_attendances
  group by 1, 2
),
base as (
  select
    a.*,
    coalesce(t.atendimentos, 0) as atendimentos,
    round(a.custo_brl / nullif(a.chamadas, 0), 6) as custo_por_chamada_brl,
    round(100.0 * a.chamadas_com_erro / nullif(a.chamadas, 0), 2) as taxa_erro_pct,
    coalesce(s.monthly_budget_brl, 50.00) as orcamento_mensal_brl,
    to_date(a.mes || '-01', 'YYYY-MM-DD') as mes_inicio
  from agg a
  left join atend t on t.clinic_id = a.clinic_id and t.mes = a.mes
  left join ai_cost_settings s on s.clinic_id = a.clinic_id
)
select
  b.clinic_id,
  b.mes,
  b.chamadas,
  lag(b.chamadas) over w as chamadas_mes_anterior,
  b.chamadas_com_erro,
  b.taxa_erro_pct as taxa_erro_atual_pct,
  lag(b.taxa_erro_pct) over w as taxa_erro_mes_anterior_pct,
  b.tokens_entrada,
  b.tokens_saida,
  round(b.custo_brl, 4) as custo_brl_atual,
  round(lag(b.custo_brl) over w, 4) as custo_brl_mes_anterior,
  round(100.0 * (b.custo_brl - lag(b.custo_brl) over w) / nullif(lag(b.custo_brl) over w, 0), 2) as variacao_mom_pct,
  b.orcamento_mensal_brl,
  round(100.0 * b.custo_brl / b.orcamento_mensal_brl, 2) as pct_orcamento,
  -- Projeção só faz sentido no mês corrente (dias corridos em Belém).
  case when b.mes = to_char(now() at time zone 'America/Belem', 'YYYY-MM')
       then round(b.custo_brl
         * extract(day from (b.mes_inicio + interval '1 month' - interval '1 day'))
         / greatest(extract(day from (now() at time zone 'America/Belem')), 1), 4)
  end as custo_projetado_brl,
  round(b.custo_por_chamada_brl, 6) as custo_por_chamada_atual_brl,
  round(lag(b.custo_por_chamada_brl) over w, 6) as custo_por_chamada_mes_anterior_brl,
  b.atendimentos,
  round(b.custo_brl / nullif(b.atendimentos, 0), 4) as custo_por_atendimento_atual_brl,
  round(lag(b.custo_brl / nullif(b.atendimentos, 0)) over w, 4) as custo_por_atendimento_mes_anterior_brl,
  b.chamadas_sem_preco
from base b
window w as (partition by b.clinic_id order by b.mes);

create or replace view metabase_ai_cost_by_feature with (security_invoker = true) as
with agg as (
  select
    d.clinic_id,
    d.mes,
    d.provider,
    d.feature,
    count(*) as chamadas,
    count(*) filter (where not d.success) as chamadas_com_erro,
    sum(d.input_tokens) as tokens_entrada,
    sum(d.output_tokens + d.thinking_tokens) as tokens_saida,
    round(avg(d.latency_ms)) as latencia_media_ms,
    sum(d.custo_brl) as custo_brl
  from metabase_ai_usage_detail d
  group by d.clinic_id, d.mes, d.provider, d.feature
)
select
  a.clinic_id,
  a.mes,
  a.provider,
  a.feature,
  a.chamadas,
  lag(a.chamadas) over w as chamadas_mes_anterior,
  a.chamadas_com_erro,
  a.tokens_entrada,
  a.tokens_saida,
  a.latencia_media_ms,
  round(a.custo_brl, 4) as custo_brl_atual,
  round(lag(a.custo_brl) over w, 4) as custo_brl_mes_anterior,
  round(100.0 * (a.custo_brl - lag(a.custo_brl) over w) / nullif(lag(a.custo_brl) over w, 0), 2) as variacao_mom_pct,
  round(100.0 * a.custo_brl / nullif(sum(a.custo_brl) over (partition by a.clinic_id, a.mes), 0), 2) as participacao_no_mes_pct
from agg a
window w as (partition by a.clinic_id, a.provider, a.feature order by a.mes);
