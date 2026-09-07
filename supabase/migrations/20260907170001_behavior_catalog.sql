-- supabase/migrations/20260907170001_behavior_catalog.sql
-- PRD §9.4: "Comportamentos-alvo observados (lista configurável)". Hoje a
-- lista é literal em lib/session-note-fields.ts (BEHAVIOR_TYPES), com um
-- comentário admitindo que "configuração pelo supervisor ainda não existe".
--
-- `value` é a chave gravada dentro de session_notes.structured.comportamentos[].tipo.
-- Como session_notes é append-only (nenhuma policy de UPDATE, por design),
-- um `value` já usado é IMUTÁVEL na prática: renomear ou apagar deixa
-- evoluções assinadas com um código sem rótulo. Por isso a tela do supervisor
-- desativa (active = false), nunca deleta, e edita só o `label`.
create table behavior_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  value text not null,
  label text not null,
  discipline text,                       -- null = vale para todas as disciplinas
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, value),
  constraint behavior_catalog_value_format check (value ~ '^[a-z0-9_]{2,40}$')
);

alter table behavior_catalog enable row level security;

-- Leitura pela clínica inteira: o terapeuta precisa da lista para montar o
-- formulário de evolução, e a recepção/supervisão para renderizar o rótulo
-- no prontuário. Escrita só supervisor/gestor (§9.4 diz "configurável pelo
-- supervisor").
create policy behavior_catalog_read on behavior_catalog for select
  using (clinic_id = (select current_clinic_id()));

-- Policies separadas por comando em vez de `for all`, seguindo
-- 20260905123903_consolidate_manage_policies_perf.sql: um `for all` vira
-- policy permissiva extra no SELECT e o advisor reclama.
create policy behavior_catalog_manage_ins on behavior_catalog for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy behavior_catalog_manage_upd on behavior_catalog for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));

create index idx_behavior_catalog_clinic_active
  on behavior_catalog (clinic_id, active, sort_order);

-- Seed = exatamente os 8 valores hoje literais em lib/session-note-fields.ts,
-- para que nenhuma evolução já assinada perca o rótulo do comportamento.
insert into behavior_catalog (clinic_id, value, label, sort_order)
select c.id, v.value, v.label, v.ord
from clinics c
cross join (values
  ('agitacao', 'Agitação', 1),
  ('estereotipia', 'Estereotipia', 2),
  ('birra_crise', 'Birra/crise', 3),
  ('autolesao', 'Autolesão', 4),
  ('agressividade', 'Agressividade', 5),
  ('choro', 'Choro', 6),
  ('recusa_atividade', 'Recusa de atividade', 7),
  ('outro', 'Outro', 8)
) as v(value, label, ord)
on conflict (clinic_id, value) do nothing;
