-- supabase/migrations/20260904000005_treatment_plans.sql
create table treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  version int not null default 1,
  status text not null default 'rascunho' check (status in ('rascunho','aprovado','encerrado')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  review_due_at date,
  discipline_mix jsonb not null default '{}'::jsonb
);

create table plan_goals (
  id uuid primary key default gen_random_uuid(),
  treatment_plan_id uuid not null references treatment_plans(id),
  discipline text not null,
  domain text not null,
  description text not null,
  criterion text,
  baseline text,
  target text,
  status text not null default 'ativa' check (status in ('ativa','atingida','suspensa')),
  achieved_at timestamptz,
  validated_by uuid references profiles(id)
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  plan_goal_id uuid not null references plan_goals(id),
  domain_taxonomy_id uuid references domain_taxonomy(id),
  protocol_item_id uuid references protocol_items(id),
  name text not null,
  target_type text not null check (target_type in ('tentativa','duracao','frequencia','tarefa')),
  mastery_criterion text,
  check (
    (domain_taxonomy_id is not null and protocol_item_id is null)
    or (domain_taxonomy_id is null and protocol_item_id is not null)
  )
);

alter table treatment_plans enable row level security;
alter table plan_goals enable row level security;
alter table programs enable row level security;

create policy treatment_plans_read on treatment_plans for select
  using (
    exists (
      select 1 from patients pt where pt.id = treatment_plans.patient_id and pt.clinic_id = current_clinic_id()
    )
    and (
      app_current_role() in ('gestor','supervisor')
      or has_patient_access(patient_id, array['terapeuta','responsavel'])
    )
  );

create policy treatment_plans_write_terapeuta on treatment_plans for insert
  with check (
    app_current_role() in ('terapeuta','supervisor')
    and exists (
      select 1 from patients pt where pt.id = treatment_plans.patient_id and pt.clinic_id = current_clinic_id()
    )
  );

create policy treatment_plans_approve_supervisor on treatment_plans for update
  using (
    app_current_role() in ('supervisor','gestor')
    and exists (
      select 1 from patients pt where pt.id = treatment_plans.patient_id and pt.clinic_id = current_clinic_id()
    )
  );

create policy plan_goals_read on plan_goals for select
  using (
    exists (
      select 1 from treatment_plans tp
      join patients pt on pt.id = tp.patient_id
      where tp.id = plan_goals.treatment_plan_id
      and pt.clinic_id = current_clinic_id()
      and (app_current_role() in ('gestor','supervisor') or has_patient_access(tp.patient_id, array['terapeuta','responsavel']))
    )
  );

create policy plan_goals_write on plan_goals for all
  using (
    app_current_role() in ('terapeuta','supervisor','gestor')
    and exists (
      select 1 from treatment_plans tp
      join patients pt on pt.id = tp.patient_id
      where tp.id = plan_goals.treatment_plan_id
      and pt.clinic_id = current_clinic_id()
    )
  );

create policy programs_read on programs for select
  using (
    exists (
      select 1 from plan_goals pg
      join treatment_plans tp on tp.id = pg.treatment_plan_id
      join patients pt on pt.id = tp.patient_id
      where pg.id = programs.plan_goal_id
      and pt.clinic_id = current_clinic_id()
      and (app_current_role() in ('gestor','supervisor') or has_patient_access(tp.patient_id, array['terapeuta']))
    )
  );

create policy programs_write on programs for all
  using (
    app_current_role() in ('terapeuta','supervisor','gestor')
    and exists (
      select 1 from plan_goals pg
      join treatment_plans tp on tp.id = pg.treatment_plan_id
      join patients pt on pt.id = tp.patient_id
      where pg.id = programs.plan_goal_id
      and pt.clinic_id = current_clinic_id()
    )
  );
