-- Oferta automática de horários da 1ª avaliação: depois que o plano autoriza
-- a guia, o bot do WhatsApp (Twilio) oferece 3 horários ao responsável, ele
-- escolhe, e a Supervisão confirma na Agenda 1ª Avaliação.
--
-- `evaluation_offers` é a marca de estado no banco. Antes, a oferta de
-- horários só existia em `chatbot_sessions.collected_data` (sem trilha, sem
-- como a agenda saber que a criança está "aguardando o responsável" e sem
-- como expirar/lembrar). O estado agora é consultável e publicado no
-- realtime pra agenda piscar quando o responsável escolhe.
--
-- Máquina de estados:
--   aguardando_interesse → aguardando_escolha → aguardando_supervisor → confirmado
--   (+ expirado, cancelado, falhou, sem_horario)
-- A reserva do horário é ATÔMICA (book_evaluation_offer_slot_atomic): mesma
-- técnica de book_intake_lead_slot_atomic (lock da oferta + checagem de
-- sobreposição + captura de exclusion_violation), e também captura as
-- exceções dos guards de disponibilidade e de expediente
-- (appointments_availability_guard, appointments_clinic_hours_guard).

create table evaluation_offers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  draft_id uuid references registration_drafts(id) on delete set null,
  phone_e164 text not null,
  conversation_id uuid,
  status text not null default 'aguardando_interesse' check (status in (
    'aguardando_interesse', 'aguardando_escolha', 'aguardando_supervisor',
    'confirmado', 'expirado', 'cancelado', 'falhou', 'sem_horario'
  )),
  -- Slots mostrados na última lista enviada ({index,label,starts_at,ends_at,therapist_id,room_id}).
  offered_slots jsonb,
  -- Página do "Nenhum serve": 0 = 3 primeiros, 1 = 3 seguintes...
  page integer not null default 0 check (page >= 0),
  invalid_attempts integer not null default 0 check (invalid_attempts >= 0),
  appointment_id uuid references appointments(id) on delete set null,
  first_message_sid text,
  sent_at timestamptz,
  reminder_sent_at timestamptz,
  expires_at timestamptz,
  chosen_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(id),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma oferta viva por criança: torna o disparo idempotente (clique duplo em
-- "Plano autorizou" não manda duas mensagens).
create unique index evaluation_offers_one_active_per_patient
  on evaluation_offers (patient_id)
  where status in ('aguardando_interesse', 'aguardando_escolha', 'aguardando_supervisor');

create index idx_evaluation_offers_clinic_status on evaluation_offers (clinic_id, status);
create index idx_evaluation_offers_phone_active on evaluation_offers (phone_e164)
  where status in ('aguardando_interesse', 'aguardando_escolha', 'aguardando_supervisor');
create index idx_evaluation_offers_appointment on evaluation_offers (appointment_id) where appointment_id is not null;

alter table evaluation_offers enable row level security;

-- Leitura pela equipe que opera a agenda. Sem policy de escrita: quem grava é
-- o service role (bot/webhook/server actions com admin client) e as RPCs.
create policy evaluation_offers_read on evaluation_offers for select
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));

-- Realtime: a agenda assina esta tabela pra destacar a escolha do responsável.
alter table evaluation_offers replica identity full;
alter publication supabase_realtime add table evaluation_offers;

-- ---------------------------------------------------------------------
-- Reserva atômica do horário escolhido pelo responsável.
-- ---------------------------------------------------------------------
create function book_evaluation_offer_slot_atomic(
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

-- ---------------------------------------------------------------------
-- Supervisão confirma o horário escolhido: o card deixa de ser provisório.
-- Quem chama (server action) envia a mensagem de confirmação depois de
-- checar success.
-- ---------------------------------------------------------------------
create function confirm_evaluation_offer(p_offer_id uuid, p_confirmed_by uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_offer record;
begin
  select * into v_offer from evaluation_offers where id = p_offer_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Oferta não encontrada.');
  end if;

  if v_offer.status <> 'aguardando_supervisor' then
    return jsonb_build_object('success', false, 'error', 'Esta oferta não está aguardando confirmação.');
  end if;

  update appointments
  set status = 'confirmada',
      is_provisional = false,
      confirmed_at = now(),
      confirmed_via = 'whatsapp_supervisor_ok'
  where id = v_offer.appointment_id
    and status not in ('cancelada_familia', 'cancelada_terapeuta', 'cancelada_clinica', 'remarcada');

  if not found then
    return jsonb_build_object('success', false, 'error', 'O agendamento desta oferta não está mais ativo.');
  end if;

  update evaluation_offers
  set status = 'confirmado', confirmed_at = now(), confirmed_by = p_confirmed_by, updated_at = now()
  where id = p_offer_id;

  return jsonb_build_object('success', true, 'patient_id', v_offer.patient_id, 'appointment_id', v_offer.appointment_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Supervisão recusa o horário: libera a vaga e a oferta volta a "escolha"
-- (quem chama gera e envia uma nova lista).
-- ---------------------------------------------------------------------
create function reject_evaluation_offer(p_offer_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_offer record;
begin
  select * into v_offer from evaluation_offers where id = p_offer_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Oferta não encontrada.');
  end if;

  if v_offer.status <> 'aguardando_supervisor' then
    return jsonb_build_object('success', false, 'error', 'Esta oferta não está aguardando confirmação.');
  end if;

  if v_offer.appointment_id is not null then
    update appointments
    set status = 'cancelada_clinica'
    where id = v_offer.appointment_id;
  end if;

  update evaluation_offers
  set status = 'aguardando_escolha',
      appointment_id = null,
      offered_slots = null,
      chosen_at = null,
      page = 0,
      invalid_attempts = 0,
      updated_at = now()
  where id = p_offer_id;

  return jsonb_build_object('success', true, 'patient_id', v_offer.patient_id);
end;
$$;

revoke all on function book_evaluation_offer_slot_atomic(uuid, uuid, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function confirm_evaluation_offer(uuid, uuid) from public, anon, authenticated;
revoke all on function reject_evaluation_offer(uuid) from public, anon, authenticated;
