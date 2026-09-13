-- supabase/migrations/20260913010000_pts_requires_evaluation_done.sql
-- PTS só pode ser iniciado para paciente que concluiu a 1ª avaliação/anamnese/acolhimento
-- (patients.evaluated_at preenchido). Reforça em RLS a validação já feita em
-- app/supervisao/planos/novo/actions.ts.

drop policy if exists treatment_plans_write_supervisor on treatment_plans;

create policy treatment_plans_write_supervisor on treatment_plans for insert
  with check (
    app_current_role() in ('supervisor', 'gestor')
    and exists (
      select 1 from patients pt
      where pt.id = treatment_plans.patient_id
        and pt.clinic_id = current_clinic_id()
        and pt.evaluated_at is not null
    )
  );
