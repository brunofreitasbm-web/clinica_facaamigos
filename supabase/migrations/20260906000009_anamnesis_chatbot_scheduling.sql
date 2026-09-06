-- supabase/migrations/20260906000009_anamnesis_chatbot_scheduling.sql
-- Módulo de Agendamento Autônomo de Anamnese/Avaliação via Chatbot Twilio WhatsApp

-- 1. Tabela para máquina de estados das sessões de Chatbot
create table if not exists chatbot_sessions (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  current_step text not null default 'idle',
  collected_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_chatbot_sessions_phone on chatbot_sessions(phone_number);

-- 2. Tabela de requisições de agendamento de anamnese/avaliação
create table if not exists anamnesis_scheduling_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) default 'c0000000-0000-0000-0000-000000000001',
  guardian_name text not null,
  guardian_phone text not null,
  guardian_cpf text not null,
  child_name text not null,
  laudo_pdf_url text,
  guia_pdf_url text,
  status text not null default 'pendente_supervisor'
    check (status in ('pendente_supervisor', 'aprovado', 'rejeitado', 'agendado', 'cancelado')),
  rejection_reason text,
  supervisor_id uuid references profiles(id),
  approved_at timestamptz,
  selected_slot_starts_at timestamptz,
  selected_slot_ends_at timestamptz,
  appointment_id uuid references appointments(id),
  patient_id uuid references patients(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_anamnesis_requests_status on anamnesis_scheduling_requests(status);
create index if not exists idx_anamnesis_requests_phone on anamnesis_scheduling_requests(guardian_phone);

alter table chatbot_sessions enable row level security;
alter table anamnesis_scheduling_requests enable row level security;

-- Políticas de RLS permissivas para o painel de recepcionistas/supervisores e Service Role
create policy chatbot_sessions_admin on chatbot_sessions
  for all using (true) with check (true);

create policy anamnesis_requests_admin on anamnesis_scheduling_requests
  for all using (true) with check (true);

-- 3. Função RPC para Reserva de Slot com Lock Otimista (SELECT FOR UPDATE)
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
  if v_request.patient_id is null then
    insert into patients (name, clinic_id, is_active)
    values (v_request.child_name, v_request.clinic_id, true)
    returning id into v_patient_id;
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
