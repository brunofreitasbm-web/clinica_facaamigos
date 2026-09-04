-- supabase/migrations/20260904000011_metrics.sql

-- Create targets table: metas por cargo e métrica
create table targets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  role text not null,
  metric_key text not null,
  period text not null check (period in ('mensal','trimestral','semestral')),
  target_value numeric(10,2) not null,
  weight numeric(5,2) not null
);

-- Create metric_snapshots table: snapshots de métricas computadas
create table metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  scope_type text not null check (scope_type in ('clinica','profile','insurer')),
  scope_id uuid,
  period_start date not null,
  period_end date not null,
  value numeric(12,4) not null,
  computed_at timestamptz not null default now()
);

-- Create survey_responses table: respostas de NPS/satisfação
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  guardian_id uuid not null references guardians(id),
  period text not null,
  nps_score int check (nps_score between 0 and 10),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

-- Enable row-level security
alter table targets enable row level security;
alter table metric_snapshots enable row level security;
alter table survey_responses enable row level security;

-- TARGETS policies: simples pois tem clinic_id direto
create policy targets_read on targets for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor','faturamento','recepcao','terapeuta'));

create policy targets_manage on targets for all
  using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

-- METRIC_SNAPSHOTS policies: restringir por clínica baseado em scope_type
-- Caso 1: scope_type='clinica' → apenas se scope_id = clinic atual (gestor/supervisor)
-- Caso 2: scope_type='profile' → terapeuta vê sua própria, gestor/supervisor veem profiles da sua clínica
-- Caso 3: scope_type='insurer' → apenas gestor/supervisor
create policy metric_snapshots_read on metric_snapshots for select
  using (
    app_current_role() in ('gestor','supervisor') and (
      -- scope_type='clinica': restringe ao scope_id = clinic atual
      (scope_type = 'clinica' and scope_id = current_clinic_id())
      -- scope_type='profile': valida que profile pertence à clínica, mas deixa gestor/supervisor ler
      or (scope_type = 'profile' and exists (
        select 1 from profiles p where p.id = scope_id and p.clinic_id = current_clinic_id()
      ))
      -- scope_type='insurer': permite gestor/supervisor (não há validação de insurer = clinic_id)
      or scope_type = 'insurer'
    )
    or (
      -- Terapeuta vê apenas seu próprio profile
      scope_type = 'profile' and scope_id = auth.uid() and app_current_role() = 'terapeuta'
    )
  );

create policy metric_snapshots_write on metric_snapshots for insert
  with check (app_current_role() = 'gestor');

-- SURVEY_RESPONSES policies: não tem clinic_id direto, usa patient → clinic_id
create policy survey_responses_read on survey_responses for select
  using (
    -- Gestor/supervisor leem apenas surveys de pacientes da sua clínica
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from patients pat where pat.id = patient_id and pat.clinic_id = current_clinic_id())
  );

create policy survey_responses_write on survey_responses for insert
  with check (exists (select 1 from guardians g where g.id = survey_responses.guardian_id and g.profile_id = auth.uid()));
