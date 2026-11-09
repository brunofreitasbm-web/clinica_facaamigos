-- supabase/migrations/20261109120000_profiles_can_create_pts.sql
-- Permite que terapeutas específicos montem o PTS (treatment_plans) sem virar
-- supervisor: flag por perfil, marcada pelo gestor no cadastro do colaborador.
-- Aprovação/validação continuam exclusivas de supervisor/gestor.
alter table profiles add column if not exists can_create_pts boolean not null default false;

create or replace function current_profile_can_pts() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(can_create_pts, false) from profiles where id = auth.uid();
$$;

-- O próprio usuário não pode se auto-promover (gestor usa profiles_admin_update).
alter policy "profiles_self_update" on public."profiles"
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select app_current_role())
    and clinic_id = (select current_clinic_id())
    and esdm_certified = (select current_esdm_certified())
    and active = (select current_profile_active())
    and can_create_pts = (select current_profile_can_pts())
  );

drop policy if exists treatment_plans_write_supervisor on treatment_plans;

create policy treatment_plans_write_supervisor on treatment_plans for insert
  with check (
    (
      (select app_current_role()) in ('supervisor', 'gestor')
      or (
        (select app_current_role()) = 'terapeuta'
        and (select current_profile_can_pts())
        and has_patient_access(treatment_plans.patient_id, array['terapeuta'])
      )
    )
    and exists (
      select 1 from patients pt
      where pt.id = treatment_plans.patient_id
        and pt.clinic_id = (select current_clinic_id())
        and pt.evaluated_at is not null
    )
  );
