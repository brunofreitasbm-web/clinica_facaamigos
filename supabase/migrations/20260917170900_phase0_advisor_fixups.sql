-- supabase/migrations/20260917170900_phase0_advisor_fixups.sql
-- Correções apontadas pelo advisor de segurança logo após aplicar a Fase 0
-- (20260917170000..20260917170800): RLS ligada sem policy em
-- receipt_counters (mesmo desenho de checkin_ticket_counters, 20260908040000
-- -- só a função security definer toca a tabela), search_path mutável em
-- funções que não eram security definer e uma trigger security definer
-- executável via RPC por anon/authenticated sem necessidade.
alter table receipt_counters enable row level security;

revoke execute on function trg_acolhimento_requests_intake_sync() from public, anon, authenticated;

create or replace function resolve_procedure_code(p_patient_id uuid, p_specialty text)
returns text
language sql stable security invoker set search_path = public as $$
  select ipc.procedure_code
  from patient_insurance pi
  join insurer_procedure_codes ipc
    on ipc.insurer_id = pi.insurer_id and ipc.specialty_value = p_specialty
  where pi.patient_id = p_patient_id
    and pi.is_private = false
  limit 1;
$$;

create or replace function appointments_group_capacity_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_max int;
  v_count int;
  v_min_birth date;
  v_max_birth date;
  v_new_birth date;
  v_diff_years numeric;
begin
  if new.modality <> 'grupo'
     or new.status in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.therapist_id::text || new.starts_at::text));

  select coalesce(max(ipc.max_group_size), 3)
  into v_max
  from patient_insurance pi
  join insurer_procedure_codes ipc
    on ipc.insurer_id = pi.insurer_id and ipc.specialty_value = new.discipline
  where pi.patient_id = new.patient_id and pi.is_private = false;

  select count(*), min(pt.birth_date), max(pt.birth_date)
  into v_count, v_min_birth, v_max_birth
  from appointments a
  join patients pt on pt.id = a.patient_id
  where a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and a.therapist_id = new.therapist_id
    and a.modality = 'grupo'
    and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
    and tstzrange(a.starts_at, a.ends_at) && tstzrange(new.starts_at, new.ends_at);

  if v_count >= v_max then
    raise exception 'GRUPO_LOTADO: limite de % crianças neste horário', v_max;
  end if;

  if v_count > 0 then
    select birth_date into v_new_birth from patients where id = new.patient_id;
    v_diff_years := greatest(
      extract(year from age(v_new_birth, v_min_birth)),
      extract(year from age(v_max_birth, v_new_birth))
    );
    if v_diff_years > 2 then
      raise exception 'GRUPO_FAIXA_ETARIA: diferença de idade superior a 2 anos em relação às demais crianças do horário';
    end if;
  end if;

  if new.group_id is null then
    new.group_id := md5(new.therapist_id::text || new.starts_at::text)::uuid;
  end if;

  return new;
end;
$$;

create or replace function group_slot_occupancy(p_therapist_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns table(occupied int, max_size int, min_birth date, max_birth date, patient_names text[])
language sql stable security invoker set search_path = public as $$
  select
    count(*)::int,
    3,
    min(pt.birth_date),
    max(pt.birth_date),
    array_agg(pt.full_name order by pt.full_name)
  from appointments a
  join patients pt on pt.id = a.patient_id
  where a.therapist_id = p_therapist_id
    and a.modality = 'grupo'
    and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
    and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_starts_at, p_ends_at);
$$;

create or replace function appointments_prior_auth_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_requires boolean;
  v_has_active_auth boolean;
begin
  if new.is_evaluation or new.is_provisional
     or new.status in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada') then
    return new;
  end if;

  select coalesce(ipc.requires_prior_auth, false)
  into v_requires
  from patient_insurance pi
  join insurer_procedure_codes ipc
    on ipc.insurer_id = pi.insurer_id and ipc.specialty_value = new.discipline
  where pi.patient_id = new.patient_id and pi.is_private = false;

  if not coalesce(v_requires, false) then
    return new;
  end if;

  select exists (
    select 1
    from authorizations au
    join patient_insurance pi on pi.id = au.patient_insurance_id
    where pi.patient_id = new.patient_id
      and au.status = 'ativa'
      and au.valid_from <= (new.starts_at at time zone 'America/Sao_Paulo')::date
      and au.valid_to >= (new.starts_at at time zone 'America/Sao_Paulo')::date
  ) into v_has_active_auth;

  if not v_has_active_auth then
    raise exception 'GUIA_OBRIGATORIA: valide a autorização/guia antes de agendar esta especialidade para este convênio';
  end if;

  return new;
end;
$$;

create or replace function unjustified_consecutive_faltas(p_patient_id uuid) returns int
language plpgsql stable set search_path = public as $$
declare
  r record;
  v_consecutive int := 0;
  v_counting boolean := true;
begin
  for r in
    select a.id, a.status
    from appointments a
    where a.patient_id = p_patient_id
      and a.status in ('realizada','falta_familia')
    order by a.starts_at desc
  loop
    if not v_counting then
      exit;
    end if;
    if r.status = 'falta_familia' then
      if exists (select 1 from absence_reports ar where ar.appointment_id = r.id and ar.status = 'aprovado') then
        v_counting := false;
      else
        v_consecutive := v_consecutive + 1;
      end if;
    else
      v_counting := false;
    end if;
  end loop;

  return v_consecutive;
end;
$$;

create or replace function trg_appointments_auto_discharge() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'falta_familia' and (old.status is distinct from new.status) then
    begin
      perform apply_auto_discharge(new.patient_id, new.id);
    exception when others then
      raise warning 'apply_auto_discharge falhou para paciente %: %', new.patient_id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create or replace function acolhimento_can_schedule(p_request_id uuid) returns text
language plpgsql stable set search_path = public as $$
declare
  r acolhimento_requests%rowtype;
  v_has_referral boolean;
  v_has_active_auth boolean;
begin
  select * into r from acolhimento_requests where id = p_request_id;
  if r.funding = 'particular' then
    return null;
  end if;

  select exists (
    select 1 from documents d where d.patient_id = r.patient_id and d.category = 'pedido_medico'
  ) into v_has_referral;

  if not v_has_referral then
    return 'PEDIDO_MEDICO_AUSENTE';
  end if;

  select exists (
    select 1 from authorizations au
    join patient_insurance pi on pi.id = au.patient_insurance_id
    where pi.patient_id = r.patient_id and au.status = 'ativa'
  ) into v_has_active_auth;

  if not v_has_active_auth then
    return 'GUIA_NAO_VALIDADA';
  end if;

  return null;
end;
$$;

create or replace function trg_acolhimento_requests_schedule_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_reason text;
begin
  if new.status = 'agendado' and old.status is distinct from new.status then
    v_reason := acolhimento_can_schedule(new.id);
    if v_reason is not null then
      raise exception '%', v_reason;
    end if;
  end if;
  return new;
end;
$$;

create or replace function monthly_presence_sheet(p_patient_id uuid, p_month_start timestamptz, p_month_end timestamptz)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  therapist_name text,
  discipline text,
  status text,
  presence_sheet_signed_at timestamptz,
  guide_signed_at timestamptz,
  guide_number text
)
language sql stable security invoker set search_path = public as $$
  select
    a.id,
    a.starts_at,
    pr.full_name,
    a.discipline,
    a.status,
    a.presence_sheet_signed_at,
    a.guide_signed_at,
    au.guide_number
  from appointments a
  join profiles pr on pr.id = a.therapist_id
  left join authorizations au on au.id = a.authorization_id
  where a.patient_id = p_patient_id
    and a.starts_at >= p_month_start
    and a.starts_at < p_month_end
  order by a.starts_at;
$$;

grant execute on function monthly_presence_sheet(uuid, timestamptz, timestamptz) to authenticated;
