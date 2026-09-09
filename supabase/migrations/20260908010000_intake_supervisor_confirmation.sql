-- Acolhimento de convênio: adiciona um passo de confirmação do supervisor
-- entre "família escolheu o horário" e "agendamento definitivo". Antes,
-- book_intake_lead_slot_atomic (20260907170006) já deixava o lead como
-- 'scheduled' assim que a família respondia com o número do horário — a
-- mensagem final de confirmação ia direto, sem revisão humana. Agora o
-- agendamento fica reservado (appointment 'agendada' + lead
-- 'pending_confirmation') até o supervisor confirmar ou recusar.

alter table insurance_intake_leads drop constraint insurance_intake_leads_status_check;
alter table insurance_intake_leads add constraint insurance_intake_leads_status_check check (status in (
  'extracted', 'approved', 'awaiting_documents', 'pending_supervisor',
  'awaiting_slot', 'pending_confirmation', 'scheduled', 'failed', 'cancelled'
));

alter table insurance_intake_leads add column confirmed_at timestamptz;
alter table insurance_intake_leads add column confirmed_by uuid references profiles(id);

drop index insurance_intake_leads_active_phone_idx;
create unique index insurance_intake_leads_active_phone_idx on insurance_intake_leads (phone_e164)
  where status in ('awaiting_documents', 'pending_supervisor', 'awaiting_slot', 'pending_confirmation');

-- Reescreve book_intake_lead_slot_atomic: mesma lógica de reserva atômica,
-- só troca o status final de 'scheduled' pra 'pending_confirmation'.
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

  if v_lead.status in ('scheduled', 'pending_confirmation') then
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
      v_lead.patient_id, p_therapist_id, p_room_id, p_discipline, p_starts_at, p_ends_at, 'individual', 'agendada', true
    ) returning id into v_appointment_id;
  exception when exclusion_violation then
    return jsonb_build_object(
      'success', false,
      'error', 'O horário selecionado acabou de ser reservado por outro paciente. Escolha outro horário vago.'
    );
  end;

  update insurance_intake_leads
  set status = 'pending_confirmation',
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

-- Supervisor confirma o agendamento reservado: só troca o status do lead
-- pra 'scheduled' (o appointment já está 'agendada' desde a reserva) — quem
-- chama (app/supervisao/acolhimento-actions.ts) é responsável por disparar
-- a mensagem final de confirmação por WhatsApp depois de checar success.
create function confirm_intake_lead_appointment(
  p_lead_id uuid,
  p_confirmed_by uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
begin
  select * into v_lead from insurance_intake_leads where id = p_lead_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Acolhimento não encontrado.');
  end if;

  if v_lead.status <> 'pending_confirmation' then
    return jsonb_build_object('success', false, 'error', 'Este acolhimento não está aguardando confirmação.');
  end if;

  update insurance_intake_leads
  set status = 'scheduled',
      confirmed_at = now(),
      confirmed_by = p_confirmed_by,
      updated_at = now()
  where id = p_lead_id;

  return jsonb_build_object('success', true, 'appointment_id', v_lead.appointment_id, 'patient_id', v_lead.patient_id);
end;
$$;

revoke all on function confirm_intake_lead_appointment(uuid, uuid) from public, anon, authenticated;

-- Supervisor recusa o horário reservado: cancela o appointment, libera o
-- lead de volta pra 'awaiting_slot' (o app recalcula novas opções e reenvia
-- a lista, igual approveIntakeLeadDocuments faz na primeira oferta).
create function reject_intake_lead_appointment(
  p_lead_id uuid,
  p_rejected_by uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
begin
  select * into v_lead from insurance_intake_leads where id = p_lead_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Acolhimento não encontrado.');
  end if;

  if v_lead.status <> 'pending_confirmation' then
    return jsonb_build_object('success', false, 'error', 'Este acolhimento não está aguardando confirmação.');
  end if;

  if v_lead.appointment_id is not null then
    update appointments
    set status = 'cancelada_clinica', updated_at = now()
    where id = v_lead.appointment_id;
  end if;

  update insurance_intake_leads
  set status = 'awaiting_slot',
      appointment_id = null,
      offered_slots = null,
      scheduled_at = null,
      updated_at = now()
  where id = p_lead_id;

  return jsonb_build_object('success', true, 'patient_id', v_lead.patient_id);
end;
$$;

revoke all on function reject_intake_lead_appointment(uuid, uuid) from public, anon, authenticated;
