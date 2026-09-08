-- Onda 1: aperta RLS de patient_contracts/contract_invoices (dado financeiro
-- particular do paciente, deve ser só gestor — o módulo é acessado em
-- /gestor/contratos, fora do prefixo liberado para faturamento/recepção) e
-- de inventory_items/inventory_movements (leitura para qualquer perfil
-- clínico, escrita só gestor, que é quem acessa /gestor/cadastros/estoque).
-- A migration 20260908050000_new_modules criou essas tabelas com uma única
-- policy "FOR ALL USING (clinic_id = ...)" que, sem WITH CHECK dedicado,
-- libera INSERT/UPDATE/DELETE pra qualquer perfil autenticado da clínica.

drop policy if exists "Patient contracts clinic scope policy" on patient_contracts;
drop policy if exists "Contract invoices clinic scope policy" on contract_invoices;
drop policy if exists "Inventory items clinic scope policy" on inventory_items;
drop policy if exists "Inventory movements clinic scope policy" on inventory_movements;

create policy patient_contracts_read on patient_contracts
  for select using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy patient_contracts_write on patient_contracts
  for insert with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy patient_contracts_update on patient_contracts
  for update using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy patient_contracts_delete on patient_contracts
  for delete using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy contract_invoices_read on contract_invoices
  for select using (
    app_current_role() = 'gestor'
    and contract_id in (select id from patient_contracts where clinic_id = current_clinic_id())
  );

create policy contract_invoices_write on contract_invoices
  for insert with check (
    app_current_role() = 'gestor'
    and contract_id in (select id from patient_contracts where clinic_id = current_clinic_id())
  );

create policy contract_invoices_update on contract_invoices
  for update using (
    app_current_role() = 'gestor'
    and contract_id in (select id from patient_contracts where clinic_id = current_clinic_id())
  );

create policy inventory_items_read on inventory_items
  for select using (clinic_id = current_clinic_id() and app_current_role() <> 'responsavel');

create policy inventory_items_write on inventory_items
  for insert with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy inventory_items_update on inventory_items
  for update using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy inventory_items_delete on inventory_items
  for delete using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy inventory_movements_read on inventory_movements
  for select using (
    app_current_role() <> 'responsavel'
    and item_id in (select id from inventory_items where clinic_id = current_clinic_id())
  );

create policy inventory_movements_write on inventory_movements
  for insert with check (
    app_current_role() = 'gestor'
    and item_id in (select id from inventory_items where clinic_id = current_clinic_id())
  );
