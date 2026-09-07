-- Complementa 20260907180000_open_session_note_signing: abrir só
-- appointments/session_notes/trial_data pra "qualquer terapeuta pode
-- assinar qualquer sessão" não bastava — o formulário de evolução também
-- precisa ler nome do paciente (patients), convênio (patient_insurance),
-- contato de emergência/autorização (RPCs patient_contact_summary /
-- patient_authorization_summary), metas ativas (plan_goals), plano de
-- tratamento (treatment_plans) e programas ABA (programs). Todas essas
-- policies só liberavam 'terapeuta' via has_patient_access (vínculo
-- explícito terapeuta↔paciente) — um terapeuta substituto sem esse vínculo
-- via essas ficava sem ver nada disso. Decisão: qualquer terapeuta da
-- clínica passa a ter leitura ampla desses dados, igual já valia pra
-- gestor/supervisor.

drop policy patients_read on patients;
create policy patients_read on patients for select
  using (
    (clinic_id = (select current_clinic_id()))
    and (
      (select app_current_role()) = any (array['gestor','supervisor','recepcao','faturamento','terapeuta'])
      or (select has_patient_access(patients.id, array['responsavel']))
    )
  );

drop policy patient_insurance_read on patient_insurance;
create policy patient_insurance_read on patient_insurance for select
  using (
    exists (
      select 1 from patients pt
      where pt.id = patient_insurance.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) = any (array['gestor','supervisor','recepcao','faturamento','terapeuta'])
  );

drop policy plan_goals_read on plan_goals;
create policy plan_goals_read on plan_goals for select
  using (
    exists (
      select 1 from treatment_plans tp
      join patients pt on pt.id = tp.patient_id
      where tp.id = plan_goals.treatment_plan_id
        and pt.clinic_id = (select current_clinic_id())
        and (
          (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
          or (select has_patient_access(tp.patient_id, array['responsavel']))
        )
    )
  );

drop policy programs_read on programs;
create policy programs_read on programs for select
  using (
    exists (
      select 1 from plan_goals pg
      join treatment_plans tp on tp.id = pg.treatment_plan_id
      join patients pt on pt.id = tp.patient_id
      where pg.id = programs.plan_goal_id
        and pt.clinic_id = (select current_clinic_id())
        and (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
    )
  );

drop policy treatment_plans_read on treatment_plans;
create policy treatment_plans_read on treatment_plans for select
  using (
    exists (
      select 1 from patients pt
      where pt.id = treatment_plans.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (
      (select app_current_role()) = any (array['gestor','supervisor','terapeuta'])
      or (select has_patient_access(treatment_plans.patient_id, array['responsavel']))
    )
  );

create or replace function patient_contact_summary(p_patient_id uuid)
returns table (
  guardian_id uuid,
  guardian_name text,
  phone text,
  relationship text,
  is_emergency_contact boolean,
  is_financial boolean,
  image_consent boolean
)
language plpgsql stable security definer set search_path = 'public' as $$
begin
  if not exists (
    select 1 from patients p
    where p.id = p_patient_id and p.clinic_id = current_clinic_id()
  ) then
    raise exception 'access denied';
  end if;

  if not (
    app_current_role() in ('gestor','supervisor','recepcao','terapeuta')
    or has_patient_access(p_patient_id, array['responsavel'])
  ) then
    raise exception 'access denied';
  end if;

  return query
    select g.id, g.full_name, g.phone, g.relationship,
           g.is_emergency_contact, g.is_financial, g.image_consent
    from guardians g
    where g.patient_id = p_patient_id
    order by g.is_emergency_contact desc, g.full_name;
end;
$$;

create or replace function patient_authorization_summary(p_patient_id uuid)
returns table (
  authorization_id uuid,
  patient_insurance_id uuid,
  insurer_name text,
  guide_number text,
  procedure_code text,
  sessions_used int,
  sessions_authorized int,
  valid_from date,
  valid_to date,
  status text
)
language plpgsql stable security definer set search_path = 'public' as $$
begin
  if not exists (
    select 1 from patients p
    where p.id = p_patient_id and p.clinic_id = current_clinic_id()
  ) then
    raise exception 'access denied';
  end if;

  if not (
    app_current_role() in ('gestor','supervisor','recepcao','faturamento','terapeuta')
    or has_patient_access(p_patient_id, array['responsavel'])
  ) then
    raise exception 'access denied';
  end if;

  return query
    select a.id, pi.id, i.name, a.guide_number, a.procedure_code, a.sessions_used,
           a.sessions_authorized, a.valid_from, a.valid_to, a.status
    from authorizations a
    join patient_insurance pi on pi.id = a.patient_insurance_id
    left join insurers i on i.id = pi.insurer_id
    where pi.patient_id = p_patient_id
    order by a.valid_from desc;
end;
$$;
