-- supabase/migrations/20260917170400_group_psychotherapy_guard.sql
-- Psicoterapia infantil via convênio (até 9 anos) pode ser em grupo de até 3
-- crianças da MESMA faixa etária (diferença máxima de 2 anos); psicoterapia
-- adulto via convênio é sempre individual e exige guia de autorização
-- prévia validada ANTES do primeiro atendimento. Os EXCLUDE GIST de
-- appointments (20260904000006/20260904000024) já tiram `modality='grupo'`
-- do índice de exclusão — esta migration é o único limite de capacidade e
-- faixa etária para esse caso, por isso usa lock consultivo de transação
-- para não permitir 4ª criança sob concorrência (dois cliques simultâneos).
create function appointments_group_capacity_guard() returns trigger
language plpgsql as $$
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

  -- Serializa por (terapeuta, horário): evita duas crianças simultâneas
  -- lerem "2 no grupo" e as duas inserirem como a 3ª.
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

  -- Agrupa por (terapeuta, horário) quando a recepção não informou group_id.
  if new.group_id is null then
    new.group_id := md5(new.therapist_id::text || new.starts_at::text)::uuid;
  end if;

  return new;
end;
$$;

create trigger trg_appointments_group_capacity_guard
  before insert or update of status, starts_at, therapist_id, modality, patient_id on appointments
  for each row execute function appointments_group_capacity_guard();

-- Ocupação do slot em grupo — usado pela UI (app/recepcao/nova-sessao-dialog.tsx,
-- app/supervisao/grade-panel.tsx) para mostrar "2/3" e os nomes já agendados.
create function group_slot_occupancy(p_therapist_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns table(occupied int, max_size int, min_birth date, max_birth date, patient_names text[])
language sql stable as $$
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

-- Guia prévia obrigatória: paciente de convênio numa especialidade marcada
-- como requires_prior_auth (padrão true) não pode nem ser AGENDADO sem
-- autorização ativa — mais estrito que appointments_authorization_guard
-- (20260904000006/006b), que só bloqueia ao entrar em 'realizada'. Não se
-- aplica a avaliação (is_evaluation) nem a sessão provisória
-- (is_provisional), que ainda estão em fase de triagem/acolhimento.
create function appointments_prior_auth_guard() returns trigger
language plpgsql as $$
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

create trigger trg_appointments_prior_auth_guard
  before insert on appointments
  for each row execute function appointments_prior_auth_guard();
