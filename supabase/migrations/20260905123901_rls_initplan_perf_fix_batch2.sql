-- supabase/migrations/20260905123901_rls_initplan_perf_fix_batch2.sql
-- Continuação da 20260905123900: mesmo wrap `(select ...)` em auth.uid(),
-- current_clinic_id(), app_current_role(), has_patient_access() e
-- is_certified_for_protocol() nas policies das tabelas do domínio
-- FaçaAmigos que existiam no banco vivo mas ainda não tinham migração
-- neste repo (recursos/agendamento de salas, feed familiar, relatórios
-- de falta e rascunho, tags e cobranças de paciente, logs ABC). Nenhuma
-- regra de acesso muda — mesma expressão booleana, só o wrap.

ALTER POLICY "aba_abc_logs_insert" ON public."aba_abc_logs"
  WITH CHECK (((therapist_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = aba_abc_logs.appointment_id) AND (p.clinic_id = ( SELECT current_clinic_id())) AND (a.therapist_id = ( SELECT auth.uid())))))));

ALTER POLICY "aba_abc_logs_read" ON public."aba_abc_logs"
  USING (((EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = aba_abc_logs.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR (therapist_id = ( SELECT auth.uid())) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])))));

ALTER POLICY "absence_reports_insert" ON public."absence_reports"
  WITH CHECK (((reported_by = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = absence_reports.appointment_id) AND ( SELECT has_patient_access(a.patient_id, ARRAY['responsavel'::text])))))));

ALTER POLICY "absence_reports_read" ON public."absence_reports"
  USING (((EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = absence_reports.appointment_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text])) OR (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.id = absence_reports.appointment_id) AND ( SELECT has_patient_access(a.patient_id, ARRAY['responsavel'::text]))))))));

ALTER POLICY "absence_reports_update_staff" ON public."absence_reports"
  USING (((EXISTS ( SELECT 1
   FROM (appointments a
     JOIN patients p ON ((p.id = a.patient_id)))
  WHERE ((a.id = absence_reports.appointment_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text]))));

ALTER POLICY "draft_reports_insert" ON public."draft_reports"
  WITH CHECK (((generated_by = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = draft_reports.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])))));

ALTER POLICY "draft_reports_read" ON public."draft_reports"
  USING (((EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = draft_reports.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])))));

ALTER POLICY "draft_reports_update" ON public."draft_reports"
  USING (((EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = draft_reports.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])))));

ALTER POLICY "feed_media_insert" ON public."feed_media"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM feed_posts fp
  WHERE ((fp.id = feed_media.post_id) AND (fp.author_id = ( SELECT auth.uid()))))));

ALTER POLICY "feed_media_read" ON public."feed_media"
  USING ((EXISTS ( SELECT 1
   FROM (feed_posts fp
     JOIN patients p ON ((p.id = fp.patient_id)))
  WHERE ((fp.id = feed_media.post_id) AND (p.clinic_id = ( SELECT current_clinic_id())) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text])) OR ( SELECT has_patient_access(fp.patient_id, ARRAY['terapeuta'::text, 'responsavel'::text])))))));

ALTER POLICY "feed_posts_insert" ON public."feed_posts"
  WITH CHECK (((author_id = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = feed_posts.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])))));

ALTER POLICY "feed_posts_read" ON public."feed_posts"
  USING (((EXISTS ( SELECT 1
   FROM patients p
  WHERE ((p.id = feed_posts.patient_id) AND (p.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text, 'responsavel'::text])))));

ALTER POLICY "patient_charges_read" ON public."patient_charges"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_charges.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'faturamento'::text]))));

ALTER POLICY "patient_charges_write" ON public."patient_charges"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_charges.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "patient_tags_read" ON public."patient_tags"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_tags.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'faturamento'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text, 'responsavel'::text])))));

ALTER POLICY "patient_tags_write" ON public."patient_tags"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = patient_tags.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['recepcao'::text, 'supervisor'::text, 'gestor'::text]))));

ALTER POLICY "reassessment_alerts_read" ON public."reassessment_alerts"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = reassessment_alerts.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])))));

ALTER POLICY "reassessment_alerts_update" ON public."reassessment_alerts"
  USING (((EXISTS ( SELECT 1
   FROM patients pt
  WHERE ((pt.id = reassessment_alerts.patient_id) AND (pt.clinic_id = ( SELECT current_clinic_id()))))) AND ((( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text])) OR ( SELECT has_patient_access(patient_id, ARRAY['terapeuta'::text])))));

ALTER POLICY "resource_bookings_insert" ON public."resource_bookings"
  WITH CHECK (((booked_by = ( SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM resources r
  WHERE ((r.id = resource_bookings.resource_id) AND (r.clinic_id = ( SELECT current_clinic_id()))))) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text, 'terapeuta'::text]))));

ALTER POLICY "resource_bookings_read" ON public."resource_bookings"
  USING ((EXISTS ( SELECT 1
   FROM resources r
  WHERE ((r.id = resource_bookings.resource_id) AND (r.clinic_id = ( SELECT current_clinic_id()))))));

ALTER POLICY "resource_bookings_update" ON public."resource_bookings"
  USING (((EXISTS ( SELECT 1
   FROM resources r
  WHERE ((r.id = resource_bookings.resource_id) AND (r.clinic_id = ( SELECT current_clinic_id()))))) AND ((booked_by = ( SELECT auth.uid())) OR (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text, 'recepcao'::text])))));

ALTER POLICY "resources_manage_gestor_supervisor" ON public."resources"
  USING (((clinic_id = ( SELECT current_clinic_id())) AND (( SELECT app_current_role()) = ANY (ARRAY['gestor'::text, 'supervisor'::text]))));

ALTER POLICY "resources_read" ON public."resources"
  USING ((clinic_id = ( SELECT current_clinic_id())));