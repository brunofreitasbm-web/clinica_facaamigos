-- A ficha do paciente e o painel de gestão (app/recepcao/pacientes/[id],
-- .../gestao) mostram a equipe vinculada (patient_access) pra recepção,
-- mas a policy de leitura só liberava profile_id=auth.uid() ou
-- gestor/supervisor — pra recepção a aba "Equipe" sempre vinha vazia,
-- mesmo com terapeuta/supervisor já vinculados. Abre leitura pra recepção;
-- a escrita (patient_access_manage_*) continua só supervisor/gestor —
-- recepção não define equipe clínica, só visualiza.
drop policy if exists patient_access_read on patient_access;
create policy patient_access_read on patient_access for select
  using (
    exists (select 1 from patients pt where pt.id = patient_access.patient_id and pt.clinic_id = (select current_clinic_id()))
    and (
      profile_id = (select auth.uid())
      or (select app_current_role()) = any (array['gestor','supervisor','recepcao'])
    )
  );
