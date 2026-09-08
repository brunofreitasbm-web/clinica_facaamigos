-- supabase/migrations/20260908183000_pts_creation_supervisor_only.sql
-- Restringe a inserção de novos planos terapêuticos (PTS) estritamente a Supervisores e Gestores.

drop policy if exists treatment_plans_write_terapeuta on treatment_plans;
drop policy if exists treatment_plans_write_supervisor on treatment_plans;

create policy treatment_plans_write_supervisor on treatment_plans for insert
  with check (
    app_current_role() in ('supervisor', 'gestor')
    and exists (
      select 1 from patients pt where pt.id = treatment_plans.patient_id and pt.clinic_id = current_clinic_id()
    )
  );
