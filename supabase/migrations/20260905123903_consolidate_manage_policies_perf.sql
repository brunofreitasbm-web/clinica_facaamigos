-- supabase/migrations/20260905123903_consolidate_manage_policies_perf.sql
-- Consolida a sobreposição leitura+gestão em 19 tabelas do domínio clínico
-- (achado multiple_permissive_policies do advisor). Cada uma tinha uma
-- policy "_read" (SELECT) e uma policy de gestão "FOR ALL" cujo papel já
-- está incluso, sem condição extra, nas roles permitidas pela policy de
-- leitura -- ou seja, toda linha visível/gerenciável pela policy de gestão
-- já era visível pela policy de leitura, então o SELECT da policy ALL era
-- puro trabalho duplicado em toda query de leitura.
--
-- Como ALTER POLICY não pode trocar o comando (FOR ALL -> FOR INSERT/
-- UPDATE/DELETE), cada policy ALL foi recriada como três policies
-- (insert/update/delete) com a MESMA expressão USING/WITH CHECK de antes --
-- nenhuma regra de acesso muda para insert/update/delete, e o SELECT passa
-- a ser resolvido só pela policy "_read" já existente (que já cobria o
-- mesmo papel).
--
-- Tabelas deliberadamente fora desta consolidação: plan_goals e programs
-- (a policy de escrita libera terapeuta só por cargo, mas a policy de
-- leitura exige has_patient_access() -- não é um subconjunto incondicional,
-- mexer aqui mudaria acesso de verdade) e profiles (sobreposição é entre
-- duas policies de UPDATE, não leitura+gestão, fora do padrão mecânico).

drop policy "appointment_types_manage_gestor" on public."appointment_types";
create policy "appointment_types_manage_gestor_ins" on public."appointment_types" for insert with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "appointment_types_manage_gestor_upd" on public."appointment_types" for update using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text))) with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "appointment_types_manage_gestor_del" on public."appointment_types" for delete using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

drop policy "authorizations_write" on public."authorizations";
create policy "authorizations_write_ins" on public."authorizations" for insert with check (((EXISTS ( SELECT 1
   FROM (patient_insurance pi
     JOIN patients pt ON ((pt.id = pi.patient_id)))
  WHERE ((pi.id = authorizations.patient_insurance_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "authorizations_write_upd" on public."authorizations" for update using (((EXISTS ( SELECT 1
   FROM (patient_insurance pi
     JOIN patients pt ON ((pt.id = pi.patient_id)))
  WHERE ((pi.id = authorizations.patient_insurance_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])))) with check (((EXISTS ( SELECT 1
   FROM (patient_insurance pi
     JOIN patients pt ON ((pt.id = pi.patient_id)))
  WHERE ((pi.id = authorizations.patient_insurance_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "authorizations_write_del" on public."authorizations" for delete using (((EXISTS ( SELECT 1
   FROM (patient_insurance pi
     JOIN patients pt ON ((pt.id = pi.patient_id)))
  WHERE ((pi.id = authorizations.patient_insurance_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

drop policy "billing_periods_write" on public."billing_periods";
create policy "billing_periods_write_ins" on public."billing_periods" for insert with check (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = billing_periods.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));
create policy "billing_periods_write_upd" on public."billing_periods" for update using (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = billing_periods.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))))) with check (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = billing_periods.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));
create policy "billing_periods_write_del" on public."billing_periods" for delete using (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = billing_periods.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

drop policy "domain_taxonomy_manage" on public."domain_taxonomy";
create policy "domain_taxonomy_manage_ins" on public."domain_taxonomy" for insert with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));
create policy "domain_taxonomy_manage_upd" on public."domain_taxonomy" for update using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text])))) with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));
create policy "domain_taxonomy_manage_del" on public."domain_taxonomy" for delete using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));

drop policy "glosas_write" on public."glosas";
create policy "glosas_write_ins" on public."glosas" for insert with check (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM ((billing_items bi
     JOIN billing_periods bp ON ((bp.id = bi.billing_period_id)))
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bi.id = glosas.billing_item_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));
create policy "glosas_write_upd" on public."glosas" for update using (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM ((billing_items bi
     JOIN billing_periods bp ON ((bp.id = bi.billing_period_id)))
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bi.id = glosas.billing_item_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))))) with check (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM ((billing_items bi
     JOIN billing_periods bp ON ((bp.id = bi.billing_period_id)))
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bi.id = glosas.billing_item_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));
create policy "glosas_write_del" on public."glosas" for delete using (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM ((billing_items bi
     JOIN billing_periods bp ON ((bp.id = bi.billing_period_id)))
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bi.id = glosas.billing_item_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

drop policy "guardians_write_recepcao" on public."guardians";
create policy "guardians_write_recepcao_ins" on public."guardians" for insert with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = guardians.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "guardians_write_recepcao_upd" on public."guardians" for update using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = guardians.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])))) with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = guardians.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "guardians_write_recepcao_del" on public."guardians" for delete using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = guardians.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

drop policy "price_tables_manage_gestor" on public."insurer_price_tables";
create policy "price_tables_manage_gestor_ins" on public."insurer_price_tables" for insert with check (((EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = insurer_price_tables.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "price_tables_manage_gestor_upd" on public."insurer_price_tables" for update using (((EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = insurer_price_tables.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = 'gestor'::text))) with check (((EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = insurer_price_tables.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "price_tables_manage_gestor_del" on public."insurer_price_tables" for delete using (((EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = insurer_price_tables.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = 'gestor'::text)));

drop policy "insurers_manage_gestor" on public."insurers";
create policy "insurers_manage_gestor_ins" on public."insurers" for insert with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "insurers_manage_gestor_upd" on public."insurers" for update using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text))) with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "insurers_manage_gestor_del" on public."insurers" for delete using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

drop policy "patient_access_manage" on public."patient_access";
create policy "patient_access_manage_ins" on public."patient_access" for insert with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_access.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));
create policy "patient_access_manage_upd" on public."patient_access" for update using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_access.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text])))) with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_access.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));
create policy "patient_access_manage_del" on public."patient_access" for delete using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_access.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));

drop policy "patient_charges_write" on public."patient_charges";
create policy "patient_charges_write_ins" on public."patient_charges" for insert with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_charges.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "patient_charges_write_upd" on public."patient_charges" for update using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_charges.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])))) with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_charges.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "patient_charges_write_del" on public."patient_charges" for delete using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_charges.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

drop policy "patient_insurance_write" on public."patient_insurance";
create policy "patient_insurance_write_ins" on public."patient_insurance" for insert with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_insurance.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "patient_insurance_write_upd" on public."patient_insurance" for update using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_insurance.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])))) with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_insurance.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "patient_insurance_write_del" on public."patient_insurance" for delete using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_insurance.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

drop policy "patient_tags_write" on public."patient_tags";
create policy "patient_tags_write_ins" on public."patient_tags" for insert with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_tags.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "patient_tags_write_upd" on public."patient_tags" for update using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_tags.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])))) with check (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_tags.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));
create policy "patient_tags_write_del" on public."patient_tags" for delete using (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_tags.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

drop policy "payout_items_write" on public."payout_items";
create policy "payout_items_write_ins" on public."payout_items" for insert with check (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM (payouts p
     JOIN profiles pr ON ((pr.id = p.therapist_id)))
  WHERE ((p.id = payout_items.payout_id) AND (pr.clinic_id = ( SELECT current_clinic_id())))))));
create policy "payout_items_write_upd" on public."payout_items" for update using (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM (payouts p
     JOIN profiles pr ON ((pr.id = p.therapist_id)))
  WHERE ((p.id = payout_items.payout_id) AND (pr.clinic_id = ( SELECT current_clinic_id()))))))) with check (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM (payouts p
     JOIN profiles pr ON ((pr.id = p.therapist_id)))
  WHERE ((p.id = payout_items.payout_id) AND (pr.clinic_id = ( SELECT current_clinic_id())))))));
create policy "payout_items_write_del" on public."payout_items" for delete using (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM (payouts p
     JOIN profiles pr ON ((pr.id = p.therapist_id)))
  WHERE ((p.id = payout_items.payout_id) AND (pr.clinic_id = ( SELECT current_clinic_id())))))));

drop policy "payouts_write" on public."payouts";
create policy "payouts_write_ins" on public."payouts" for insert with check (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payouts.therapist_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));
create policy "payouts_write_upd" on public."payouts" for update using (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payouts.therapist_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))))) with check (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payouts.therapist_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));
create policy "payouts_write_del" on public."payouts" for delete using (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payouts.therapist_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

drop policy "protocol_items_manage" on public."protocol_items";
create policy "protocol_items_manage_ins" on public."protocol_items" for insert with check (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM protocols p
  WHERE ((p.id = protocol_items.protocol_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));
create policy "protocol_items_manage_upd" on public."protocol_items" for update using (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM protocols p
  WHERE ((p.id = protocol_items.protocol_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))))) with check (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM protocols p
  WHERE ((p.id = protocol_items.protocol_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));
create policy "protocol_items_manage_del" on public."protocol_items" for delete using (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM protocols p
  WHERE ((p.id = protocol_items.protocol_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

drop policy "protocols_manage" on public."protocols";
create policy "protocols_manage_ins" on public."protocols" for insert with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "protocols_manage_upd" on public."protocols" for update using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text))) with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "protocols_manage_del" on public."protocols" for delete using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

drop policy "resources_manage_gestor_supervisor" on public."resources";
create policy "resources_manage_gestor_supervisor_ins" on public."resources" for insert with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));
create policy "resources_manage_gestor_supervisor_upd" on public."resources" for update using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])))) with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));
create policy "resources_manage_gestor_supervisor_del" on public."resources" for delete using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));

drop policy "rooms_manage_by_supervisor_gestor" on public."rooms";
create policy "rooms_manage_by_supervisor_gestor_ins" on public."rooms" for insert with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));
create policy "rooms_manage_by_supervisor_gestor_upd" on public."rooms" for update using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])))) with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));
create policy "rooms_manage_by_supervisor_gestor_del" on public."rooms" for delete using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));

drop policy "targets_manage" on public."targets";
create policy "targets_manage_ins" on public."targets" for insert with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "targets_manage_upd" on public."targets" for update using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text))) with check (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
create policy "targets_manage_del" on public."targets" for delete using (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));
