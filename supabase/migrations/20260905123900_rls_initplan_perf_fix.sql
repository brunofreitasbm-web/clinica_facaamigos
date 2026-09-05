-- Otimização de performance RLS: envolve chamadas de função STABLE
-- (current_clinic_id(), app_current_role(), auth.uid(), has_patient_access(),
-- is_certified_for_protocol()) em '(select ...)' para o planner do Postgres
-- avaliar uma vez por query (initplan) em vez de uma vez por linha.
-- Nenhuma regra de acesso muda -- mesma expressão booleana, só o wrap.

ALTER POLICY "appointment_types_manage_gestor" ON public."appointment_types"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

ALTER POLICY "appointment_types_read" ON public."appointment_types"
  USING ((clinic_id = ( SELECT current_clinic_id())));

ALTER POLICY "appointments_read" ON public."appointments"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = appointments.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'faturamento'::text])) OR (therapist_id = ( SELECT auth.uid())) OR ( SELECT has_patient_access(patient_id, ARRAY['responsavel'::text])))));

ALTER POLICY "appointments_update" ON public."appointments"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = appointments.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])) OR (therapist_id = ( SELECT auth.uid())))));

ALTER POLICY "appointments_write_recepcao_supervisor" ON public."appointments"
  WITH CHECK (((( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = appointments.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "audit_log_read" ON public."audit_log"
  USING (((( SELECT app_current_role()) = 'gestor'::text) AND (clinic_id = ( SELECT current_clinic_id()))));

ALTER POLICY "authorizations_read" ON public."authorizations"
  USING (((EXISTS ( SELECT 1
   FROM (patient_insurance pi
     JOIN patients pt ON ((pt.id = pi.patient_id)))
  WHERE ((pi.id = authorizations.patient_insurance_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'faturamento'::text]))));

ALTER POLICY "authorizations_write" ON public."authorizations"
  USING (((EXISTS ( SELECT 1
   FROM (patient_insurance pi
     JOIN patients pt ON ((pt.id = pi.patient_id)))
  WHERE ((pi.id = authorizations.patient_insurance_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "billing_items_read" ON public."billing_items"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'faturamento'::text])) AND (EXISTS ( SELECT 1
   FROM (billing_periods bp
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bp.id = billing_items.billing_period_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "billing_items_update" ON public."billing_items"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM (billing_periods bp
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bp.id = billing_items.billing_period_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "billing_items_write" ON public."billing_items"
  WITH CHECK (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM (billing_periods bp
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bp.id = billing_items.billing_period_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "billing_periods_read" ON public."billing_periods"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'faturamento'::text])) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = billing_periods.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "billing_periods_write" ON public."billing_periods"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = billing_periods.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "clinics_read" ON public."clinics"
  USING ((id = ( SELECT current_clinic_id())));

ALTER POLICY "documents_read" ON public."documents"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'faturamento'::text])) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = documents.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))) OR (( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = documents.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))) OR (( SELECT has_patient_access(patient_id, ARRAY['responsavel'::text])) AND (shared_with_family = true) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = documents.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))))));

ALTER POLICY "documents_update" ON public."documents"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = documents.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))))
  WITH CHECK (((( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = documents.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "documents_write" ON public."documents"
  WITH CHECK ((((( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = documents.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))) OR (( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = documents.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))))));

ALTER POLICY "domain_taxonomy_manage" ON public."domain_taxonomy"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));

ALTER POLICY "domain_taxonomy_read" ON public."domain_taxonomy"
  USING ((clinic_id = ( SELECT current_clinic_id())));

ALTER POLICY "glosas_read" ON public."glosas"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'faturamento'::text])) AND (EXISTS ( SELECT 1
   FROM ((billing_items bi
     JOIN billing_periods bp ON ((bp.id = bi.billing_period_id)))
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bi.id = glosas.billing_item_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))) OR ((attributable_to = 'terapeuta'::text) AND (attributable_profile_id = ( SELECT auth.uid())))));

ALTER POLICY "glosas_write" ON public."glosas"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['faturamento'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM ((billing_items bi
     JOIN billing_periods bp ON ((bp.id = bi.billing_period_id)))
     JOIN insurers i ON ((i.id = bp.insurer_id)))
  WHERE ((bi.id = glosas.billing_item_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "guardians_read" ON public."guardians"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = guardians.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text])) OR (profile_id = ( SELECT auth.uid())))));

ALTER POLICY "guardians_write_recepcao" ON public."guardians"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = guardians.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "price_tables_manage_gestor" ON public."insurer_price_tables"
  USING (((EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = insurer_price_tables.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = 'gestor'::text)));

ALTER POLICY "price_tables_read" ON public."insurer_price_tables"
  USING (((EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = insurer_price_tables.insurer_id) AND (i.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'faturamento'::text]))));

ALTER POLICY "insurers_manage_gestor" ON public."insurers"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

ALTER POLICY "insurers_read" ON public."insurers"
  USING ((clinic_id = ( SELECT current_clinic_id())));

ALTER POLICY "messages_read" ON public."messages"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = messages.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['responsavel'::text, 'terapeuta'::text])))));

ALTER POLICY "messages_update_staff" ON public."messages"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = messages.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = messages.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "messages_write" ON public."messages"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = messages.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['responsavel'::text])))));

ALTER POLICY "metric_snapshots_read" ON public."metric_snapshots"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (((scope_type = 'clinica'::text) AND (scope_id = ( SELECT current_clinic_id()))) OR ((scope_type = 'profile'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = metric_snapshots.scope_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))) OR ((scope_type = 'insurer'::text) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = metric_snapshots.scope_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))))) OR ((scope_type = 'profile'::text) AND (scope_id = ( SELECT auth.uid())) AND (( SELECT app_current_role()) = 'terapeuta'::text))));

ALTER POLICY "metric_snapshots_write" ON public."metric_snapshots"
  WITH CHECK (((( SELECT app_current_role()) = 'gestor'::text) AND (((scope_type = 'clinica'::text) AND (scope_id = ( SELECT current_clinic_id()))) OR ((scope_type = 'profile'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = metric_snapshots.scope_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))) OR ((scope_type = 'insurer'::text) AND (EXISTS ( SELECT 1
   FROM insurers i
  WHERE ((i.id = metric_snapshots.scope_id) AND (i.clinic_id = ( SELECT current_clinic_id())))))))));

ALTER POLICY "patient_access_manage" ON public."patient_access"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_access.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text]))));

ALTER POLICY "patient_access_read" ON public."patient_access"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_access.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((profile_id = ( SELECT auth.uid())) OR (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])))));

ALTER POLICY "patient_insurance_read" ON public."patient_insurance"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_insurance.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'faturamento'::text]))));

ALTER POLICY "patient_insurance_write" ON public."patient_insurance"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_insurance.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "patients_read" ON public."patients"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'faturamento'::text])) OR ( SELECT has_patient_access(id, ARRAY['terapeuta'::text, 'responsavel'::text])))));

ALTER POLICY "patients_update_recepcao_supervisor" ON public."patients"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "patients_write_recepcao_supervisor" ON public."patients"
  WITH CHECK (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "payout_items_read" ON public."payout_items"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'faturamento'::text])) AND (EXISTS ( SELECT 1
   FROM (payouts p
     JOIN profiles pr ON ((pr.id = p.therapist_id)))
  WHERE ((p.id = payout_items.payout_id) AND (pr.clinic_id = ( SELECT current_clinic_id())))))) OR (EXISTS ( SELECT 1
   FROM payouts p
  WHERE ((p.id = payout_items.payout_id) AND (p.therapist_id = ( SELECT auth.uid())))))));

ALTER POLICY "payout_items_write" ON public."payout_items"
  USING (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM (payouts p
     JOIN profiles pr ON ((pr.id = p.therapist_id)))
  WHERE ((p.id = payout_items.payout_id) AND (pr.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "payouts_read" ON public."payouts"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'faturamento'::text])) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payouts.therapist_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))) OR (therapist_id = ( SELECT auth.uid()))));

ALTER POLICY "payouts_write" ON public."payouts"
  USING (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payouts.therapist_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "plan_goals_read" ON public."plan_goals"
  USING ((EXISTS ( SELECT 1
   FROM (treatment_plans tp
     JOIN patients pt ON ((pt.id = tp.patient_id)))
  WHERE ((tp.id = plan_goals.treatment_plan_id) AND (pt.clinic_id = ( SELECT current_clinic_id())) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(tp.patient_id, ARRAY['terapeuta'::text, 'responsavel'::text])))))));

ALTER POLICY "plan_goals_write" ON public."plan_goals"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['terapeuta'::text, 'supervisor'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM (treatment_plans tp
     JOIN patients pt ON ((pt.id = tp.patient_id)))
  WHERE ((tp.id = plan_goals.treatment_plan_id) AND (pt.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "profiles_admin_update" ON public."profiles"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)))
  WITH CHECK (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

ALTER POLICY "profiles_read_same_clinic" ON public."profiles"
  USING ((clinic_id = ( SELECT current_clinic_id())));

ALTER POLICY "profiles_self_update" ON public."profiles"
  USING ((id = ( SELECT auth.uid())))
  WITH CHECK (((id = ( SELECT auth.uid())) AND (role = ( SELECT p.role
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid())))) AND (clinic_id = ( SELECT p.clinic_id
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid())))) AND (esdm_certified = ( SELECT p.esdm_certified
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid())))) AND (active = ( SELECT p.active
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid()))))));

ALTER POLICY "programs_read" ON public."programs"
  USING ((EXISTS ( SELECT 1
   FROM ((plan_goals pg
     JOIN treatment_plans tp ON ((tp.id = pg.treatment_plan_id)))
     JOIN patients pt ON ((pt.id = tp.patient_id)))
  WHERE ((pg.id = programs.plan_goal_id) AND (pt.clinic_id = ( SELECT current_clinic_id())) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(tp.patient_id, ARRAY['terapeuta'::text])))))));

ALTER POLICY "programs_write" ON public."programs"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['terapeuta'::text, 'supervisor'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM ((plan_goals pg
     JOIN treatment_plans tp ON ((tp.id = pg.treatment_plan_id)))
     JOIN patients pt ON ((pt.id = tp.patient_id)))
  WHERE ((pg.id = programs.plan_goal_id) AND (pt.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "protocol_assessments_read" ON public."protocol_assessments"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ((( SELECT app_current_role()) = 'terapeuta'::text) AND ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])) AND ( SELECT is_certified_for_protocol(protocol_id)))) AND (EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = protocol_assessments.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "protocol_assessments_write" ON public."protocol_assessments"
  WITH CHECK (((( SELECT app_current_role()) = ANY (ARRAY['terapeuta'::text, 'supervisor'::text])) AND ( SELECT is_certified_for_protocol(protocol_id)) AND (EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = protocol_assessments.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "protocol_items_manage" ON public."protocol_items"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM protocols p
  WHERE ((p.id = protocol_items.protocol_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "protocol_items_read" ON public."protocol_items"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ((( SELECT app_current_role()) = 'terapeuta'::text) AND ( SELECT is_certified_for_protocol(protocol_id)))) AND (EXISTS ( SELECT 1
   FROM protocols p
  WHERE ((p.id = protocol_items.protocol_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "protocols_manage" ON public."protocols"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

ALTER POLICY "protocols_read" ON public."protocols"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'terapeuta'::text]))));

ALTER POLICY "record_access_log_read" ON public."record_access_log"
  USING (((EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = record_access_log.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));

ALTER POLICY "record_access_log_write" ON public."record_access_log"
  WITH CHECK (((accessed_by = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = record_access_log.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "rooms_manage_by_supervisor_gestor" ON public."rooms"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));

ALTER POLICY "rooms_read" ON public."rooms"
  USING ((clinic_id = ( SELECT current_clinic_id())));

ALTER POLICY "session_notes_insert" ON public."session_notes"
  WITH CHECK (((therapist_id = ( SELECT auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = session_notes.appointment_id) AND (a.therapist_id = ( SELECT auth.uid())) AND (p.clinic_id = ( SELECT current_clinic_id()))))) OR ((( SELECT app_current_role()) = 'supervisor'::text) AND (EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = session_notes.appointment_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))))));

ALTER POLICY "session_notes_read" ON public."session_notes"
  USING ((EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = session_notes.appointment_id) AND (p.clinic_id = ( SELECT current_clinic_id())) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR (a.therapist_id = ( SELECT auth.uid())))))));

ALTER POLICY "survey_responses_read" ON public."survey_responses"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM patients pat
  WHERE ((pat.id = survey_responses.patient_id) AND (pat.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "survey_responses_write" ON public."survey_responses"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM guardians g
  WHERE ((g.id = survey_responses.guardian_id) AND (g.profile_id = ( SELECT auth.uid())) AND (g.patient_id = survey_responses.patient_id)))));

ALTER POLICY "targets_manage" ON public."targets"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text)));

ALTER POLICY "targets_read" ON public."targets"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'faturamento'::text, 'recepcao'::text, 'terapeuta'::text]))));

ALTER POLICY "therapist_contracts_manage_by_gestor" ON public."therapist_contracts"
  WITH CHECK (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = therapist_contracts.profile_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "therapist_contracts_manage_by_gestor_upd" ON public."therapist_contracts"
  USING (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = therapist_contracts.profile_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))))
  WITH CHECK (((( SELECT app_current_role()) = 'gestor'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = therapist_contracts.profile_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "therapist_contracts_read_own_or_admin" ON public."therapist_contracts"
  USING (((profile_id = ( SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = therapist_contracts.profile_id) AND (p.clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = 'gestor'::text))))));

ALTER POLICY "treatment_plans_approve_supervisor" ON public."treatment_plans"
  USING (((( SELECT app_current_role()) = ANY (ARRAY['supervisor'::text, 'gestor'::text])) AND (EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = treatment_plans.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "treatment_plans_read" ON public."treatment_plans"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = treatment_plans.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text, 'responsavel'::text])))));

ALTER POLICY "treatment_plans_write_terapeuta" ON public."treatment_plans"
  WITH CHECK (((( SELECT app_current_role()) = ANY (ARRAY['terapeuta'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = treatment_plans.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id())))))));

ALTER POLICY "trial_data_insert" ON public."trial_data"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = trial_data.appointment_id) AND (a.therapist_id = ( SELECT auth.uid())) AND (p.clinic_id = ( SELECT current_clinic_id()))))));

ALTER POLICY "trial_data_read" ON public."trial_data"
  USING ((((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) AND (EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = trial_data.appointment_id) AND (p.clinic_id = ( SELECT current_clinic_id())))))) OR (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = trial_data.appointment_id) AND (a.therapist_id = ( SELECT auth.uid())))))));
-- Índice duplicado (idx_trial_data_appointment == idx_trial_data_appointment_id):
-- mesma definição, custo de escrita/manutenção em dobro sem ganho de leitura.
drop index if exists idx_trial_data_appointment;
