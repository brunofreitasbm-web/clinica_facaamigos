-- Atualiza a função book_intake_lead_slot_atomic para usar o novo status 'aguardando_aprovacao_supervisao'

create or replace function book_intake_lead_slot_atomic(
  p_lead_id uuid,
  p_therapist_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_discipline text default 'Avaliação Multifuncional'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
  v_conflict_count integer;
  v_appointment_id uuid;
begin
  select * into v_lead from insurance_intake_leads where id = p_lead_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Acolhimento não encontrado.');
  end if;

  if v_lead.status = 'scheduled' then
    return jsonb_build_object('success', false, 'error', 'Este acolhimento já foi agendado anteriormente.');
  end if;

  if v_lead.status <> 'awaiting_slot' then
    return jsonb_build_object('success', false, 'error', 'Este acolhimento ainda não está aguardando escolha de horário.');
  end if;

  if v_lead.patient_id is null then
    return jsonb_build_object('success', false, 'error', 'Acolhimento sem paciente vinculado.');
  end if;

  select count(*) into v_conflict_count
  from appointments
  where (therapist_id = p_therapist_id or room_id = p_room_id)
    and status not in ('cancelada_familia', 'cancelada_terapeuta', 'cancelada_clinica', 'remarcada')
    and tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at);

  if v_conflict_count > 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'O horário selecionado acabou de ser reservado por outro paciente. Escolha outro horário vago.'
    );
  end if;

  begin
    insert into appointments (
      patient_id, therapist_id, room_id, discipline, starts_at, ends_at, modality, status, is_evaluation
    ) values (
      v_lead.patient_id, p_therapist_id, p_room_id, p_discipline, p_starts_at, p_ends_at, 'individual', 'aguardando_aprovacao_supervisao', true
    ) returning id into v_appointment_id;
  exception when exclusion_violation then
    return jsonb_build_object(
      'success', false,
      'error', 'O horário selecionado acabou de ser reservado por outro paciente. Escolha outro horário vago.'
    );
  end;

  update insurance_intake_leads
  set status = 'scheduled',
      appointment_id = v_appointment_id,
      scheduled_at = now(),
      updated_at = now()
  where id = p_lead_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'patient_id', v_lead.patient_id,
    'starts_at', p_starts_at,
    'ends_at', p_ends_at
  );
end;
$$;
