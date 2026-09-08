-- supabase/migrations/20260907180000_specialties_catalog.sql
-- Cadastro de especialidades profissionais (musicoterapia, fisioterapia,
-- psicologia ABA, fonoaudiologia, etc.), configurável pelo gestor/supervisor
-- em app/gestor/configuracoes/especialidades. Segue o mesmo padrão de
-- catálogo de behavior_catalog / intervention_catalog: `value` é uma chave
-- estável (slug) e `label` é o texto exibido, com soft-disable em vez de
-- delete para não quebrar referências futuras (ex.: terapeutas já
-- vinculados a uma especialidade).
create table specialties (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  value text not null,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, value),
  constraint specialties_value_format check (value ~ '^[a-z0-9_]{2,40}$')
);

alter table specialties enable row level security;

-- Leitura pela clínica inteira (a lista alimenta formulários de cadastro de
-- terapeuta/equipe); escrita restrita a supervisor/gestor.
create policy specialties_read on specialties for select
  using (clinic_id = (select current_clinic_id()));

-- Policies separadas por comando em vez de `for all`, seguindo
-- 20260905123903_consolidate_manage_policies_perf.sql: um `for all` vira
-- policy permissiva extra no SELECT e o advisor reclama.
create policy specialties_manage_ins on specialties for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy specialties_manage_upd on specialties for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));

create index idx_specialties_clinic_active
  on specialties (clinic_id, active, sort_order);

insert into specialties (clinic_id, value, label, sort_order)
select c.id, v.value, v.label, v.ord
from clinics c
cross join (values
  ('psicologia_aba', 'Psicologia ABA', 1),
  ('fonoaudiologia', 'Fonoaudiologia', 2),
  ('terapia_ocupacional', 'Terapia Ocupacional', 3),
  ('fisioterapia', 'Fisioterapia', 4),
  ('musicoterapia', 'Musicoterapia', 5),
  ('psicopedagogia', 'Psicopedagogia', 6),
  ('nutricao', 'Nutrição', 7),
  ('outro', 'Outro', 8)
) as v(value, label, ord)
on conflict (clinic_id, value) do nothing;
