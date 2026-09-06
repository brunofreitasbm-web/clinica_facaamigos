-- supabase/migrations/20260906000004_meetings_and_bonding.sql
-- Módulo 3 MAAIS: reunião técnica multidisciplinar (slide 10 etapa 5) e
-- reunião de devolutiva com a família (slides 36-37) hoje só existiam como
-- texto no painel de fluxos — "Reunião técnica multidisciplinar" era o único
-- passo do fluxo sem nenhuma ferramenta associada. E registro de vínculo
-- (slide 26: "o vínculo terapêutico também vira processo") não existia em
-- lugar nenhum além do campo numérico presenca_engajamento por sessão.

create table meetings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  kind text not null check (kind in ('interdisciplinar', 'devolutiva', 'revisao_pdi', 'visita_escolar')),
  held_at timestamptz not null default now(),
  conducted_by uuid not null references profiles(id),
  participants uuid[] not null default '{}'::uuid[],
  agenda jsonb not null default '{}'::jsonb,
  minutes text,
  decisions text,
  treatment_plan_id uuid references treatment_plans(id),
  family_present boolean not null default false
);

create index meetings_patient_id_idx on meetings(patient_id);

-- Registro de vínculo / relatório de acompanhamento inicial (slide 26) —
-- gerado pelo terapeuta nas primeiras semanas de atendimento, revisado pelo
-- supervisor.
create table bonding_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  therapist_id uuid not null references profiles(id),
  period_start date not null,
  period_end date not null,
  engagement_score int not null check (engagement_score between 1 and 5),
  observations text,
  ready_to_increase_demands boolean not null default false,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz
);

create index bonding_reports_patient_id_idx on bonding_reports(patient_id);

alter table meetings enable row level security;
alter table bonding_reports enable row level security;

-- Uma reunião interdisciplinar conclui a etapa correspondente do checklist; a
-- devolutiva conclui a etapa e, se ligada a um plano ainda sem entrega
-- registrada, também grava a entrega do PDI nele.
create function trg_meetings_after_insert() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if new.kind = 'interdisciplinar' then
    perform set_intake_step_complete(new.patient_id, 'reuniao_interdisciplinar', new.conducted_by);
  elsif new.kind = 'devolutiva' then
    perform set_intake_step_complete(new.patient_id, 'devolutiva_familia', new.conducted_by);
    if new.treatment_plan_id is not null then
      update treatment_plans
      set delivered_at = coalesce(delivered_at, new.held_at), delivered_by = coalesce(delivered_by, new.conducted_by)
      where id = new.treatment_plan_id and delivered_at is null;
    end if;
  end if;
  return new;
end;
$f$;

create trigger meetings_after_insert
  after insert on meetings
  for each row execute function trg_meetings_after_insert();

create policy meetings_read on meetings for select
  using (
    exists (select 1 from patients pt where pt.id = meetings.patient_id and pt.clinic_id = current_clinic_id())
    and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(patient_id, array['terapeuta']))
  );

create policy meetings_write on meetings for insert
  with check (
    app_current_role() in ('terapeuta', 'supervisor', 'gestor')
    and exists (select 1 from patients pt where pt.id = meetings.patient_id and pt.clinic_id = current_clinic_id())
  );

create policy bonding_reports_read on bonding_reports for select
  using (
    exists (select 1 from patients pt where pt.id = bonding_reports.patient_id and pt.clinic_id = current_clinic_id())
    and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(patient_id, array['terapeuta']))
  );

create policy bonding_reports_write on bonding_reports for insert
  with check (
    app_current_role() in ('terapeuta', 'supervisor')
    and exists (select 1 from patients pt where pt.id = bonding_reports.patient_id and pt.clinic_id = current_clinic_id())
  );

create policy bonding_reports_review on bonding_reports for update
  using (
    app_current_role() in ('supervisor', 'gestor')
    and exists (select 1 from patients pt where pt.id = bonding_reports.patient_id and pt.clinic_id = current_clinic_id())
  );
