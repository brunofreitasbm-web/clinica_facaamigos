-- Onda 1 (efeito colateral): billing_disallowances/disallowance_appeals
-- (módulo de Glosas, app/faturamento/glosas) foram criados pela mesma
-- migration 20260908050000_new_modules com a policy permissiva "FOR ALL
-- USING (clinic_id = ...)", sem restrição de papel. Restringe leitura e
-- escrita a gestor/faturamento, os únicos papéis com acesso à rota
-- /faturamento/glosas.

drop policy if exists "Disallowances clinic scope policy" on billing_disallowances;
drop policy if exists "Disallowance appeals clinic scope policy" on disallowance_appeals;

create policy billing_disallowances_read on billing_disallowances
  for select using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','faturamento'));

create policy billing_disallowances_write on billing_disallowances
  for insert with check (clinic_id = current_clinic_id() and app_current_role() in ('gestor','faturamento'));

create policy billing_disallowances_update on billing_disallowances
  for update using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','faturamento'));

create policy disallowance_appeals_read on disallowance_appeals
  for select using (
    app_current_role() in ('gestor','faturamento')
    and disallowance_id in (select id from billing_disallowances where clinic_id = current_clinic_id())
  );

create policy disallowance_appeals_write on disallowance_appeals
  for insert with check (
    app_current_role() in ('gestor','faturamento')
    and disallowance_id in (select id from billing_disallowances where clinic_id = current_clinic_id())
  );

create policy disallowance_appeals_update on disallowance_appeals
  for update using (
    app_current_role() in ('gestor','faturamento')
    and disallowance_id in (select id from billing_disallowances where clinic_id = current_clinic_id())
  );
