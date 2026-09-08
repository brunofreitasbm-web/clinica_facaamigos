-- Configuração versionada de PLR/bonificação/faixa (§10.6 do PRD): o gestor
-- deixa de ter pesos cravados em componente React (plr-section-client.tsx) e
-- passa a montar, por cargo + módulo, um conjunto de métricas com peso, meta
-- e flag de eliminatória, com vigência (valid_from/valid_to) — igual ao
-- padrão já usado em therapist_contracts para faixa PJ. Uma vigência nova
-- fecha a anterior; nunca faz update destrutivo em cima do que já esteve
-- valendo num período apurado.
create table bonus_rule_sets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  role text not null check (role in ('recepcao','supervisor','terapeuta','faturamento')),
  module text not null check (module in ('plr','bonificacao','faixa_pj')),
  valid_from date not null,
  valid_to date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  note text,
  check (valid_to is null or valid_to >= valid_from)
);

-- Só pode haver uma vigência aberta (valid_to is null) por clínica/cargo/módulo.
create unique index bonus_rule_sets_open_unique
  on bonus_rule_sets (clinic_id, role, module)
  where valid_to is null;

create table bonus_rule_set_items (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references bonus_rule_sets(id) on delete cascade,
  metric_key text not null,
  weight_pct numeric(5,2) not null check (weight_pct > 0 and weight_pct <= 100),
  target_value numeric(12,4) not null,
  eliminatory boolean not null default false
);

create index bonus_rule_set_items_rule_set_id_idx on bonus_rule_set_items (rule_set_id);

alter table bonus_rule_sets enable row level security;
alter table bonus_rule_set_items enable row level security;

create policy bonus_rule_sets_read on bonus_rule_sets for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor'));

create policy bonus_rule_sets_manage on bonus_rule_sets for all
  using (clinic_id = current_clinic_id() and app_current_role() = 'gestor')
  with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy bonus_rule_set_items_read on bonus_rule_set_items for select
  using (
    exists (
      select 1 from bonus_rule_sets rs
      where rs.id = bonus_rule_set_items.rule_set_id
        and rs.clinic_id = current_clinic_id()
        and app_current_role() in ('gestor','supervisor')
    )
  );

create policy bonus_rule_set_items_manage on bonus_rule_set_items for all
  using (
    exists (
      select 1 from bonus_rule_sets rs
      where rs.id = bonus_rule_set_items.rule_set_id
        and rs.clinic_id = current_clinic_id()
        and app_current_role() = 'gestor'
    )
  )
  with check (
    exists (
      select 1 from bonus_rule_sets rs
      where rs.id = bonus_rule_set_items.rule_set_id
        and rs.clinic_id = current_clinic_id()
        and app_current_role() = 'gestor'
    )
  );
