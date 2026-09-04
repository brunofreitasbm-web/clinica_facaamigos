-- supabase/migrations/20260904000011b_metrics_clinic_scope_fix.sql
-- Fix Round 1: Clinic isolation in metric_snapshots (insurer scope) and survey_responses_write

-- CRITICAL: metric_snapshots_read was missing clinic validation for scope_type='insurer'
-- Insurers table has clinic_id not null (Task 3), preventing cross-clinic metric leakage
drop policy if exists metric_snapshots_read on metric_snapshots;

create policy metric_snapshots_read on metric_snapshots for select
  using (
    app_current_role() in ('gestor','supervisor') and (
      -- scope_type='clinica': must match current clinic
      (scope_type = 'clinica' and scope_id = current_clinic_id())
      -- scope_type='profile': profile must belong to current clinic
      or (scope_type = 'profile' and exists (
        select 1 from profiles p where p.id = scope_id and p.clinic_id = current_clinic_id()
      ))
      -- scope_type='insurer': insurer must belong to current clinic
      or (scope_type = 'insurer' and exists (
        select 1 from insurers i where i.id = scope_id and i.clinic_id = current_clinic_id()
      ))
    )
    or (
      -- Therapist views only their own profile metrics
      scope_type = 'profile' and scope_id = auth.uid() and app_current_role() = 'terapeuta'
    )
  );

-- IMPORTANT: survey_responses_write was only checking guardian.profile_id without clinic validation
-- Add clinic enforcement via patient FK join
drop policy if exists survey_responses_write on survey_responses;

create policy survey_responses_write on survey_responses for insert
  with check (
    exists (
      select 1 from guardians g
      join patients pt on pt.id = g.patient_id
      where g.id = survey_responses.guardian_id
        and g.profile_id = auth.uid()
        and pt.clinic_id = current_clinic_id()
    )
  );
