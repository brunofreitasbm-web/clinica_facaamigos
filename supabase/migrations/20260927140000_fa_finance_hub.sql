-- Módulo Financeiro HUB (consolidação Playground + Circuito + Clínica).
-- Acesso restrito: RLS exige app_current_role() in ('gestor','faturamento'),
-- mesmo padrão de billing_periods/accounts_payable (20260904000009,
-- 20260908070000). Sem policy pra 'select' pública — nunca é lido fora de
-- Server Component/Action autenticado.
--
-- Unidades Playground e Circuito não têm banco de dados aqui: seus números
-- de receita/caixa são lidos ao vivo do projeto Supabase do PDV
-- (ivjvpdzsfjdpyabbzzuj, ver lib/finance-hub/pos-client.ts) por Server
-- Action, nunca gravados nesta tabela. As tabelas abaixo guardam só o que
-- nenhum dos três sistemas fornece: contas do Balanço Patrimonial e os
-- lançamentos manuais mês a mês do DRE/Fluxo de Caixa (impostos, retiradas,
-- depreciação, receitas/despesas financeiras, aportes).

create table if not exists fa_fin_units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('playground', 'circuito', 'clinica')),
  nome text not null,
  fonte text not null check (fonte in ('pos_live', 'clinica_live')),
  created_at timestamptz not null default now()
);
comment on table fa_fin_units is 'As 3 unidades do HUB. fonte indica de onde vem o número ao vivo (pos_live = fa_kiosk_* no projeto do PDV; clinica_live = billing_items/accounts_payable/payouts deste mesmo projeto).';

insert into fa_fin_units (slug, nome, fonte) values
  ('playground', 'Playground (Parque Shopping)', 'pos_live'),
  ('circuito', 'Circuito (Parque Shopping)', 'pos_live'),
  ('clinica', 'Clínica Faça Amigos', 'clinica_live')
on conflict (slug) do nothing;

-- Lançamentos manuais mês a mês, por unidade, do que os 3 sistemas não
-- fornecem: impostos, depreciação, receitas/despesas financeiras, retiradas
-- e aportes de sócios, e um ajuste livre com nota explicativa.
create table if not exists fa_fin_monthly_entries (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references fa_fin_units (id),
  competence_month date not null, -- sempre dia 1º do mês
  -- Playground/Circuito: o PDV não tem contas a pagar nem custo de
  -- produto vendido — aluguel, folha, fornecedores etc. entram aqui.
  -- Clínica: normalmente fica em 0 (já vem de accounts_payable/payouts ao
  -- vivo), mas aceita complemento se algo não estiver lançado lá.
  custos_diretos_manuais numeric(12,2) not null default 0,
  despesas_operacionais_manuais numeric(12,2) not null default 0,
  impostos numeric(12,2) not null default 0,
  depreciacao numeric(12,2) not null default 0,
  receitas_financeiras numeric(12,2) not null default 0,
  despesas_financeiras numeric(12,2) not null default 0,
  retiradas_socios numeric(12,2) not null default 0,
  aportes_socios numeric(12,2) not null default 0,
  ajuste_manual numeric(12,2) not null default 0,
  ajuste_manual_nota text,
  observacoes text,
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  filled_by uuid references profiles (id),
  filled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (unit_id, competence_month)
);
comment on column fa_fin_monthly_entries.status is 'aberto = ainda editável; fechado = mês encerrado (trava edição pra quem não é gestor, mas gestor sempre pode reabrir).';

-- Plano de contas do Balanço Patrimonial. Sem sistema de origem — é 100%
-- lançamento manual (nenhum dos 3 sistemas tem controle de ativo/passivo).
create table if not exists fa_fin_balance_accounts (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  grupo text not null check (grupo in (
    'ativo_circulante', 'ativo_nao_circulante',
    'passivo_circulante', 'passivo_nao_circulante',
    'patrimonio_liquido'
  )),
  ordem integer not null default 0,
  ativo boolean not null default true
);

insert into fa_fin_balance_accounts (codigo, nome, grupo, ordem) values
  ('1.1.01', 'Caixa e bancos', 'ativo_circulante', 10),
  ('1.1.02', 'Aplicações financeiras', 'ativo_circulante', 20),
  ('1.1.03', 'Contas a receber (convênios + particulares)', 'ativo_circulante', 30),
  ('1.1.04', 'Estoque (produtos/insumos)', 'ativo_circulante', 40),
  ('1.1.05', 'Adiantamentos e outros créditos', 'ativo_circulante', 50),
  ('1.2.01', 'Imobilizado (equipamentos, brinquedos, móveis)', 'ativo_nao_circulante', 60),
  ('1.2.02', 'Depreciação acumulada (redutora)', 'ativo_nao_circulante', 70),
  ('1.2.03', 'Intangível (marca, software, benfeitorias)', 'ativo_nao_circulante', 80),
  ('2.1.01', 'Fornecedores', 'passivo_circulante', 10),
  ('2.1.02', 'Salários e encargos a pagar', 'passivo_circulante', 20),
  ('2.1.03', 'Impostos a recolher', 'passivo_circulante', 30),
  ('2.1.04', 'Empréstimos e financiamentos (curto prazo)', 'passivo_circulante', 40),
  ('2.1.05', 'Repasses a terapeutas / glosas a pagar', 'passivo_circulante', 50),
  ('2.1.06', 'Outras contas a pagar', 'passivo_circulante', 60),
  ('2.2.01', 'Empréstimos e financiamentos (longo prazo)', 'passivo_nao_circulante', 70),
  ('3.1.01', 'Capital social', 'patrimonio_liquido', 10),
  ('3.1.02', 'Lucros/prejuízos acumulados', 'patrimonio_liquido', 20)
on conflict (codigo) do nothing;

-- Saldo de cada conta, por unidade e mês. Sempre por unidade (mesmo capital
-- social) — o consolidado do HUB é a soma das 3 unidades, calculada na
-- tela, nunca uma 4ª linha própria: um unit_id nulo furaria a unique
-- constraint abaixo, porque o Postgres trata NULL como distinto de NULL.
create table if not exists fa_fin_balance_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references fa_fin_balance_accounts (id),
  unit_id uuid not null references fa_fin_units (id),
  competence_month date not null,
  valor numeric(12,2) not null default 0,
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  unique (account_id, unit_id, competence_month)
);

alter table fa_fin_units enable row level security;
alter table fa_fin_monthly_entries enable row level security;
alter table fa_fin_balance_accounts enable row level security;
alter table fa_fin_balance_entries enable row level security;

create policy fa_fin_units_read on fa_fin_units for select
  using (app_current_role() in ('gestor', 'faturamento'));

create policy fa_fin_monthly_entries_read on fa_fin_monthly_entries for select
  using (app_current_role() in ('gestor', 'faturamento'));
create policy fa_fin_monthly_entries_write on fa_fin_monthly_entries for insert
  with check (app_current_role() in ('gestor', 'faturamento'));
create policy fa_fin_monthly_entries_update on fa_fin_monthly_entries for update
  using (app_current_role() in ('gestor', 'faturamento'));

create policy fa_fin_balance_accounts_read on fa_fin_balance_accounts for select
  using (app_current_role() in ('gestor', 'faturamento'));

create policy fa_fin_balance_entries_read on fa_fin_balance_entries for select
  using (app_current_role() in ('gestor', 'faturamento'));
create policy fa_fin_balance_entries_write on fa_fin_balance_entries for insert
  with check (app_current_role() in ('gestor', 'faturamento'));
create policy fa_fin_balance_entries_update on fa_fin_balance_entries for update
  using (app_current_role() in ('gestor', 'faturamento'));
