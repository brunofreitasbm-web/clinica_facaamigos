-- supabase/migrations/20260910120000_dedup_anamnesis_booking_patient.sql
-- book_anamnesis_slot_atomic criava um `patients` novo sempre que a
-- requisição de anamnese chegava sem patient_id, sem checar se a mesma
-- criança já existia (ex.: cadastrada antes via WhatsApp/portal +
-- registration_drafts). Uma família que manda documentos por WhatsApp e
-- depois agenda a anamnese pelo mesmo WhatsApp acaba com dois registros de
-- paciente. Agora, antes de criar, tenta achar um paciente já existente do
-- mesmo responsável (mesmo CPF) e mesma criança (mesma data de nascimento,
-- com nome como critério de reforço) na mesma clínica, e reaproveita.

create or replace function book_anamnesis_slot_atomic(
  p_request_id uuid,
  p_therapist_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_discipline text default 'Psicologia'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_request record;
  v_conflict_count integer;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_matched_existing boolean := false;
begin
  -- 1. Travar a linha da requisição com FOR UPDATE
  select * into v_request
  from anamnesis_scheduling_requests
  where id = p_request_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Solicitação de agendamento não encontrada.');
  end if;

  if v_request.status = 'agendado' then
    return jsonb_build_object('success', false, 'error', 'Esta solicitação já foi agendada anteriormente.');
  end if;

  if v_request.status <> 'aprovado' then
    return jsonb_build_object('success', false, 'error', 'A solicitação ainda não foi aprovada pelo supervisor.');
  end if;

  -- 2. Verificar se o slot na agenda já está ocupado por outro agendamento no mesmo período (Lock Transacional)
  select count(*) into v_conflict_count
  from appointments
  where (therapist_id = p_therapist_id or room_id = p_room_id)
    and status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
    and tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at);

  if v_conflict_count > 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'O horário selecionado acabou de ser reservado por outro paciente. Por favor, escolha outro horário vago.'
    );
  end if;

  -- 3. Criar ou buscar paciente. Se a requisição já não tem patient_id,
  --    primeiro tenta casar com um cadastro existente (mesmo responsável
  --    por CPF + mesma criança por data de nascimento, na mesma clínica)
  --    antes de criar um novo paciente/responsável duplicado.
  if v_request.patient_id is null then
    select p.id into v_patient_id
    from guardians g
    join patients p on p.id = g.patient_id
    where g.cpf = v_request.guardian_cpf
      and p.clinic_id = v_request.clinic_id
      and (
        (v_request.child_birth_date is not null and p.birth_date = v_request.child_birth_date)
        or (v_request.child_birth_date is null and lower(trim(p.full_name)) = lower(trim(v_request.child_name)))
      )
    order by p.created_at desc
    limit 1;

    if v_patient_id is not null then
      v_matched_existing := true;
    else
      insert into patients (clinic_id, full_name, birth_date, status, entry_source, first_contact_at)
      values (
        v_request.clinic_id,
        v_request.child_name,
        v_request.child_birth_date,
        'avaliacao',
        'chatbot_whatsapp',
        v_request.created_at
      )
      returning id into v_patient_id;

      insert into guardians (patient_id, full_name, phone, cpf, is_financial)
      values (v_patient_id, v_request.guardian_name, v_request.guardian_phone, v_request.guardian_cpf, true);
    end if;
  else
    v_patient_id := v_request.patient_id;
  end if;

  -- 4. Inserir o agendamento de Anamnese/Avaliação
  insert into appointments (
    patient_id,
    therapist_id,
    room_id,
    discipline,
    starts_at,
    ends_at,
    modality,
    status,
    is_evaluation
  ) values (
    v_patient_id,
    p_therapist_id,
    p_room_id,
    p_discipline,
    p_starts_at,
    p_ends_at,
    'individual',
    'agendada',
    true
  ) returning id into v_appointment_id;

  -- 5. Atualizar a requisição como agendada
  update anamnesis_scheduling_requests
  set status = 'agendado',
      selected_slot_starts_at = p_starts_at,
      selected_slot_ends_at = p_ends_at,
      patient_id = v_patient_id,
      appointment_id = v_appointment_id,
      updated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'patient_id', v_patient_id,
    'matched_existing_patient', v_matched_existing,
    'starts_at', p_starts_at,
    'ends_at', p_ends_at
  );
end;
$$;
