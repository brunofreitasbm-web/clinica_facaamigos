-- supabase/migrations/20260907170000_terapeuta_prontuario_rls.sql
-- Ficha do paciente no portal do terapeuta (/terapeuta/paciente/[patientId]).
--
-- Hoje um terapeuta só lê as evoluções e os trials que ele mesmo assinou, e
-- só os appointments em que ele é o `therapist_id`. Numa clínica
-- multidisciplinar isso significa que a fono não vê o que a TO registrou no
-- mesmo paciente — a ficha sairia pela metade e a "frequência" mostraria só
-- a fatia daquele terapeuta, que é pior que não mostrar nada (parece
-- absenteísmo onde não há).
--
-- Critério de acesso: `has_patient_access(..., ['terapeuta'])`, ou seja, a
-- equipe vinculada ao paciente via patient_access.
--
-- Consequência aceita conscientemente: trg_grant_patient_access_on_appointment
-- (20260906000029) concede patient_access a QUALQUER terapeuta escalado numa
-- sessão, inclusive uma cobertura de um dia, e esse grant nunca é revogado.
-- Portanto quem cobriu uma sessão passa a ler o histórico daquele paciente
-- indefinidamente. A alternativa (exigir role_in_team not null) quebraria a
-- visão do próprio terapeuta de cobertura sobre o paciente que ele está
-- atendendo naquele dia, que é justamente quando ele mais precisa do
-- contexto. Decisão do gestor em 07/09/2026.
--
-- Nada aqui toca policies de INSERT: session_notes e trial_data continuam
-- append-only e restritos ao dono do appointment.

drop policy session_notes_read on session_notes;
create policy session_notes_read on session_notes for select
  using (
    exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_notes.appointment_id
        and p.clinic_id = (select current_clinic_id())
        and (
          (select app_current_role()) = any (array['gestor','supervisor'])
          or a.therapist_id = (select auth.uid())
          or (select has_patient_access(a.patient_id, array['terapeuta']))
        )
    )
  );

drop policy trial_data_read on trial_data;
create policy trial_data_read on trial_data for select
  using (
    exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = trial_data.appointment_id
        and p.clinic_id = (select current_clinic_id())
        and (
          (select app_current_role()) = any (array['gestor','supervisor'])
          or a.therapist_id = (select auth.uid())
          or (select has_patient_access(a.patient_id, array['terapeuta']))
        )
    )
  );

drop policy appointments_read on appointments;
create policy appointments_read on appointments for select
  using (
    exists (
      select 1 from patients pt
      where pt.id = appointments.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (
      (select app_current_role()) = any (array['gestor','supervisor','recepcao','faturamento'])
      or therapist_id = (select auth.uid())
      or (select has_patient_access(patient_id, array['terapeuta','responsavel']))
    )
  );

-- ---------------------------------------------------------------------------
-- Responsável e autorização: função, não policy.
--
-- RLS é por LINHA, não por coluna. Uma policy de SELECT em `guardians` daria
-- ao terapeuta cpf/rg/email do responsável via PostgREST, e uma em
-- `authorizations` daria authorization_password — independentemente do que a
-- UI renderiza. Mesmo raciocínio (e mesmo padrão) de family_guidance_feed
-- (20260906000021): função security definer devolvendo só as colunas que o
-- prontuário do terapeuta precisa.
--
-- Efeito colateral desejado: lib/patient-identity.ts hoje devolve
-- emergencyContact/activeAuthorization sempre null para terapeuta, então a
-- barra de identidade da tela de evolução está silenciosamente vazia desde
-- que existe. Passando a ler por aqui, ela finalmente preenche.
-- ---------------------------------------------------------------------------

create function patient_contact_summary(p_patient_id uuid)
returns table (
  guardian_id uuid,
  guardian_name text,
  phone text,
  relationship text,
  is_emergency_contact boolean,
  is_financial boolean,
  image_consent boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from patients p
    where p.id = p_patient_id and p.clinic_id = current_clinic_id()
  ) then
    raise exception 'access denied';
  end if;

  if not (
    app_current_role() in ('gestor','supervisor','recepcao')
    or has_patient_access(p_patient_id, array['terapeuta'])
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

revoke all on function patient_contact_summary(uuid) from public;
grant execute on function patient_contact_summary(uuid) to authenticated;

-- Nunca devolve authorization_password nem valor nenhum: PRD §4, "terapeuta
-- não pode ver valores de convênio"; a senha da guia é operação de
-- recepção/faturamento.
create function patient_authorization_summary(p_patient_id uuid)
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
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from patients p
    where p.id = p_patient_id and p.clinic_id = current_clinic_id()
  ) then
    raise exception 'access denied';
  end if;

  if not (
    app_current_role() in ('gestor','supervisor','recepcao','faturamento')
    or has_patient_access(p_patient_id, array['terapeuta'])
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

revoke all on function patient_authorization_summary(uuid) from public, anon;
grant execute on function patient_authorization_summary(uuid) to authenticated;
