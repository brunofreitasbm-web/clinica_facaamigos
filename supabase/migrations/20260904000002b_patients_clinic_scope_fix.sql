-- Fix: Add clinic_id scoping to guardians_write_recepcao, patient_access_read, patient_access_manage
-- These policies were missing clinic_id validation, allowing staff to access data from other clinics

drop policy guardians_write_recepcao on guardians;
create policy guardians_write_recepcao on guardians for all
  using (
    exists (select 1 from patients pt where pt.id = guardians.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('recepcao','supervisor','gestor')
  );

drop policy patient_access_read on patient_access;
create policy patient_access_read on patient_access for select
  using (
    exists (select 1 from patients pt where pt.id = patient_access.patient_id and pt.clinic_id = current_clinic_id())
    and (profile_id = auth.uid() or app_current_role() in ('gestor','supervisor'))
  );

drop policy patient_access_manage on patient_access;
create policy patient_access_manage on patient_access for all
  using (
    exists (select 1 from patients pt where pt.id = patient_access.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('supervisor','gestor')
  );
