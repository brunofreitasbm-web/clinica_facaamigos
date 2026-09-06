-- supabase/migrations/20260906000024_fix_book_anamnesis_slot_atomic.sql
-- Corrige book_anamnesis_slot_atomic: o insert em `patients` usava colunas
-- que não existem no schema real (name, is_active) e não informava
-- birth_date (not null, sem default) — o RPC sempre falhava ao criar
-- paciente novo. Também adiciona a coluna de data de nascimento na
-- requisição, coletada pelo bot antes do envio ao supervisor.

alter table anamnesis_scheduling_requests
  add column if not exists child_birth_date date;

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

  -- 3. Criar ou buscar paciente temporário/definitivo se necessário
  --    (colunas alinhadas ao schema real de `patients`: full_name/birth_date,
  --    sem `name`/`is_active`, que nunca existiram na tabela)
  if v_request.patient_id is null then
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
    'starts_at', p_starts_at,
    'ends_at', p_ends_at
  );
end;
$$;
