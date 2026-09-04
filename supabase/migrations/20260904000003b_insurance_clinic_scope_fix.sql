-- Fix for price_tables_manage_gestor policy: add clinic_id scope validation
-- Without this, a gestor from clinic A could modify/delete price tables of convênios from clinic B

drop policy price_tables_manage_gestor on insurer_price_tables;

create policy price_tables_manage_gestor on insurer_price_tables for all
  using (
    exists (select 1 from insurers i where i.id = insurer_price_tables.insurer_id and i.clinic_id = current_clinic_id())
    and app_current_role() = 'gestor'
  );
