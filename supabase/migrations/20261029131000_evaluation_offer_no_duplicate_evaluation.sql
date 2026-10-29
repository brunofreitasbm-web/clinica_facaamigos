-- Reserva do horário escolhido pelo responsável não cria uma 2ª 1ª avaliação.
--
-- Antes: book_evaluation_offer_slot_atomic só conferia conflito de terapeuta/sala.
-- Se a supervisão agendasse manualmente a criança enquanto a oferta estava viva,
-- a escolha do responsável gerava uma segunda avaliação para o mesmo paciente.
-- A aplicação já cancela a oferta antes do agendamento manual
-- (releaseOfferForManualScheduling); isto fecha a brecha no banco.
--
-- Depende de 20261029130000_evaluation_offers.sql (create or replace mantém os grants).

create or replace function book_evaluation_offer_slot_atomic(
  p_offer_id uuid,
  p_therapist_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_discipline text default 'Avaliação Multifuncional'
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_offer record;
  v_conflict_count integer;
  v_appointment_id uuid;
begin
  select * into v_offer from evaluation_offers where id = p_offer_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Oferta não encontrada.');
  end if;

  if v_offer.status = 'aguardando_supervisor' then
    return jsonb_build_object('success', false, 'error', 'Este horário já foi escolhido e aguarda a confirmação da clínica.');
  end if;

  if v_offer.status <> 'aguardando_escolha' then
    return jsonb_build_object('success', false, 'error', 'Esta oferta não está aguardando escolha de horário.');
  end if;

  -- Criança já com 1ª avaliação futura ativa (ex.: agendada manualmente): não duplica.
  if exists (
    select 1 from appointments
    where patient_id = v_offer.patient_id
      and is_evaluation
      and status in ('agendada', 'confirmada')
      and ends_at > now()
  ) then
    return jsonb_build_object('success', false, 'error', 'Esta criança já tem uma 1ª avaliação agendada.');
  end if;

  select count(*) into v_conflict_count
  from appointments
  where (therapist_id = p_therapist_id or room_id = p_room_id)
    and status not in ('cancelada_familia', 'cancelada_terapeuta', 'cancelada_clinica', 'remarcada')
    and tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at);

  if v_conflict_count > 0 then
    return jsonb_build_object('success', false, 'conflict', true,
      'error', 'Esse horário acabou de ser reservado por outra família.');
  end if;

  begin
    insert into appointments (
      patient_id, therapist_id, room_id, discipline, starts_at, ends_at,
      modality, status, is_evaluation, is_provisional
    ) values (
      v_offer.patient_id, p_therapist_id, p_room_id, p_discipline, p_starts_at, p_ends_at,
      'individual', 'agendada', true, true
    ) returning id into v_appointment_id;
  exception
    when exclusion_violation then
      return jsonb_build_object('success', false, 'conflict', true,
        'error', 'Esse horário acabou de ser reservado por outra família.');
    when raise_exception then
      -- Guards do banco (disponibilidade do terapeuta, clínica fechada).
      return jsonb_build_object('success', false, 'conflict', true, 'error', sqlerrm);
  end;

  update evaluation_offers
  set status = 'aguardando_supervisor',
      appointment_id = v_appointment_id,
      chosen_at = now(),
      updated_at = now()
  where id = p_offer_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'patient_id', v_offer.patient_id,
    'starts_at', p_starts_at,
    'ends_at', p_ends_at
  );
end;
$$;
