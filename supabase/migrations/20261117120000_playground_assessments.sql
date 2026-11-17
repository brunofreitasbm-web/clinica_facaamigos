-- Avaliação paralela no playground (VB-MAPP em até 5 visitas).
--
-- NÃO tem relação com a 1ª avaliação da clínica: não usa `appointments`, não
-- depende da fase do paciente e não mexe em `evaluated_at`/`intake_steps`.
-- O playground é, na prática, uma "sala de avaliação" fisicamente distante.
-- Quem preenche são terapeutas do playground sem login na clínica; os dados
-- chegam pela ponte assinada do PDV (app/api/playground/*, service role).
-- Plano e contrato: docs/playground-bridge-contract.md.

-- Locais (Parque, Grão-Pará) e o id da unidade correspondente no PDV.
create table playground_locations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  pos_unit_id text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, pos_unit_id)
);

-- Uma série = o conjunto de até 5 visitas de uma criança, com um nível de VB-MAPP.
create table playground_series (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  location_id uuid not null references playground_locations(id),
  protocol_id uuid not null references protocols(id),
  level smallint not null check (level between 1 and 3),
  total_visits smallint not null check (total_visits between 1 and 5),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'liberada', 'concluida', 'cancelada')),
  released_at timestamptz,
  released_by uuid references profiles(id),
  concluded_at timestamptz,
  concluded_by_name text,
  protocol_assessment_id uuid references protocol_assessments(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index playground_series_patient_idx on playground_series (patient_id);
create index playground_series_location_status_idx on playground_series (location_id, status);

create table playground_visits (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references playground_series(id) on delete cascade,
  visit_no smallint not null check (visit_no between 1 and 5),
  scheduled_start timestamptz not null,
  duration_min integer not null default 60 check (duration_min between 15 and 240),
  arrived_at timestamptz,
  left_at timestamptz,
  arrived_by_pos_employee_id text,
  left_by_pos_employee_id text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (series_id, visit_no)
);
create index playground_visits_start_idx on playground_visits (scheduled_start);

-- Entradas append-only. O estado atual de cada item é a última entrada dele;
-- as anteriores ficam como histórico (correção no mesmo dia, com versão).
create table playground_entries (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references playground_series(id) on delete cascade,
  visit_id uuid not null references playground_visits(id) on delete cascade,
  kind text not null check (kind in ('item', 'evolution')),
  protocol_item_id uuid references protocol_items(id),
  score numeric,
  text text,
  author_pos_employee_id text not null,
  author_name_snapshot text not null,
  author_specialty_snapshot text,
  device_id text,
  saved_at timestamptz not null,
  received_at timestamptz not null default now(),
  idempotency_key text not null unique,
  check (
    (kind = 'item' and protocol_item_id is not null and text is null)
    or (kind = 'evolution' and protocol_item_id is null and text is not null)
  )
);
create index playground_entries_series_item_idx on playground_entries (series_id, protocol_item_id, saved_at);
create index playground_entries_visit_idx on playground_entries (visit_id);

-- A conclusão gera uma linha em protocol_assessments (histórico, gráfico e
-- timeline funcionam sem mudança). Os terapeutas do playground não têm perfil
-- na clínica, então `assessed_by` pode ser nulo, só para essa origem.
alter table protocol_assessments alter column assessed_by drop not null;
alter table protocol_assessments add column source text not null default 'clinica'
  check (source in ('clinica', 'playground'));
alter table protocol_assessments add column playground_series_id uuid references playground_series(id);
alter table protocol_assessments add constraint protocol_assessments_assessed_by_required
  check (assessed_by is not null or source = 'playground');

-- Uma série gera no máximo um registro oficial (conclusão idempotente).
create unique index protocol_assessments_playground_series_uk
  on protocol_assessments (playground_series_id) where playground_series_id is not null;

alter table playground_series add constraint playground_series_assessment_fk_check
  check (status <> 'concluida' or protocol_assessment_id is not null);

-- RLS. Escrita pelos terapeutas do playground só via service role (rotas da
-- ponte). A Supervisão gerencia séries e visitas pelo próprio login. O
-- responsável NÃO enxerga nada: exibir parte disso no portal da família é
-- decisão futura da clínica.
alter table playground_locations enable row level security;
alter table playground_series enable row level security;
alter table playground_visits enable row level security;
alter table playground_entries enable row level security;

create policy playground_locations_read on playground_locations for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor', 'terapeuta', 'recepcao'));
create policy playground_locations_manage on playground_locations for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

create policy playground_series_read on playground_series for select
  using (
    clinic_id = current_clinic_id()
    and (
      app_current_role() in ('gestor', 'supervisor')
      or (app_current_role() = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']))
    )
  );
create policy playground_series_manage on playground_series for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

create policy playground_visits_read on playground_visits for select
  using (exists (select 1 from playground_series s where s.id = series_id));
create policy playground_visits_manage on playground_visits for all
  using (exists (
    select 1 from playground_series s
    where s.id = series_id and s.clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor')
  ))
  with check (exists (
    select 1 from playground_series s
    where s.id = series_id and s.clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor')
  ));

create policy playground_entries_read on playground_entries for select
  using (exists (select 1 from playground_series s where s.id = series_id));

-- Indicador de prazo para o painel da Supervisão (view read-only, RLS herdada
-- das tabelas de base via security_invoker). "No prazo" = primeira entrada até
-- 40 minutos depois da saída (ou sem saída registrada).
create view playground_sla_v with (security_invoker = true) as
select
  v.id as visit_id,
  s.clinic_id,
  s.id as series_id,
  v.scheduled_start,
  date_trunc('month', v.scheduled_start at time zone 'America/Sao_Paulo')::date as month,
  e.first_entry_at,
  (
    e.first_entry_at is not null
    and (v.left_at is null or e.first_entry_at <= v.left_at + interval '40 minutes')
  ) as on_time
from playground_visits v
join playground_series s on s.id = v.series_id
left join lateral (
  select min(saved_at) as first_entry_at from playground_entries where visit_id = v.id
) e on true
where v.cancelled_at is null
  and v.arrived_at is not null
  and s.status in ('liberada', 'concluida');
