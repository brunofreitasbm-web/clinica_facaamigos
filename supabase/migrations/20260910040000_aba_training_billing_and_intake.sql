-- supabase/migrations/20260910040000_aba_training_billing_and_intake.sql
--
-- Duas pontas soltas do Treino ABA (20260910020000_aba_training.sql):
--
-- 1. FATURAMENTO. O bloco de 2h consome 3 sessões rateadas entre as guias
--    ABA, mas `billing_items` só sabia representar "1 sessão = 1 linha" (e
--    tinha índice único por appointment_id), então um bloco de Treino ABA
--    consumia saldo sem gerar nada a faturar. A regra é faturar a
--    SOMATÓRIA consumida — cada guia que pagou vira uma linha com a
--    quantidade que pagou, no preço do próprio procedimento dela.
--
-- 2. AGENDAMENTO PELO WHATSAPP. O bloco é agendado no mesmo fluxo do bot de
--    acolhimento (lib/twilio-intake-bot.ts) em que o responsável manda guia
--    e laudo e depois escolhe o horário — só que as opções são blocos de 2h
--    numa turma, não sessões de 50min. `book_intake_lead_slot_atomic` não
--    serve: ela grava is_evaluation, modalidade individual e sala/horário
--    livres. Daí uma RPC irmã, com a mesma forma de retorno.

-- =====================================================================
-- 1. billing_items: quantidade
-- =====================================================================

-- Toda linha existente é de uma sessão só — default 1 mantém o histórico
-- intacto e `amount` continua sendo o TOTAL da linha (é o que todos os
-- consumidores somam hoje: overview, competências, DRE, glosas).
alter table billing_items add column quantity int not null default 1 check (quantity > 0);

-- Um bloco de Treino ABA pode ser pago por mais de uma guia (ex.: 2 sessões
-- da guia de Fono ABA + 1 da de TO ABA), e cada guia tem seu próprio
-- procedimento e preço — então a unicidade deixa de ser por sessão e passa
-- a ser por (sessão, procedimento). Para todo o resto do sistema, onde uma
-- sessão gera uma linha só, o efeito é o mesmo de antes.
drop index if exists billing_items_appointment_id_uniq;
create unique index billing_items_appointment_procedure_uniq
  on billing_items (appointment_id, procedure_code);

-- =====================================================================
-- 2. Geração automática do item no fechamento da sessão
-- =====================================================================

-- Mesma função de 20260906000018_auto_billing_item_on_session_close.sql,
-- com um ramo a mais pro Treino ABA. Os critérios de elegibilidade (1,3,4,5,6
-- de computeCompetenceEligibility) continuam idênticos — o que muda é de
-- onde vem o par (procedimento, quantidade): da guia única em
-- `authorization_id`, ou do rateio em `aba_training_consumptions`.
create or replace function bill_item_on_session_realizada() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  auth_row authorizations%rowtype;
  pi_row patient_insurance%rowtype;
  price_row insurer_price_tables%rowtype;
  session_date date;
  competence date;
  period_id uuid;
  v_role text;
  cons record;
begin
  if new.status <> 'realizada'
     or new.is_provisional
     or new.is_evaluation
     or (TG_OP = 'UPDATE' and old.status = 'realizada')
  then
    return new;
  end if;

  -- Critério 4 (evolução assinada). No check-out a nota normalmente ainda
  -- não existe: não é erro, só significa "ainda não dá pra faturar" — o
  -- fechamento mensal (closeCompetence) pega depois.
  if not exists (select 1 from session_notes sn where sn.appointment_id = new.id) then
    return new;
  end if;

  session_date := (new.starts_at at time zone 'America/Sao_Paulo')::date;
  competence := date_trunc('month', session_date)::date;

  select at.aba_role into v_role from appointment_types at where at.id = new.appointment_type_id;

  if coalesce(v_role, '') = 'treino' then
    -- Uma linha por guia que pagou o bloco, com a quantidade rateada. O
    -- agrupamento inclui patient_insurance_id porque o preço vigente é por
    -- convênio — duas guias de convênios diferentes não podem cair na
    -- mesma competência.
    for cons in
      select a.procedure_code, a.patient_insurance_id, sum(c.units)::int as units
      from aba_training_consumptions c
      join authorizations a on a.id = c.authorization_id
      where c.appointment_id = new.id
      group by a.procedure_code, a.patient_insurance_id
    loop
      select * into pi_row from patient_insurance
      where id = cons.patient_insurance_id and is_private = false;
      continue when not found;

      select * into price_row from insurer_price_tables
      where insurer_id = pi_row.insurer_id
        and procedure_code = cons.procedure_code
        and valid_from <= session_date
        and (valid_to is null or valid_to >= session_date)
      limit 1;
      continue when not found;

      insert into billing_periods (insurer_id, competence_month)
      values (pi_row.insurer_id, competence)
      on conflict (insurer_id, competence_month) do nothing;

      select id into period_id from billing_periods
      where insurer_id = pi_row.insurer_id and competence_month = competence;

      insert into billing_items (billing_period_id, appointment_id, procedure_code, amount, quantity)
      values (period_id, new.id, cons.procedure_code, price_row.price * cons.units, cons.units)
      on conflict (appointment_id, procedure_code) do nothing;
    end loop;

    return new;
  end if;

  if new.authorization_id is null then
    return new;
  end if;

  select * into auth_row from authorizations where id = new.authorization_id;
  if not found then
    return new;
  end if;

  select * into pi_row
  from patient_insurance
  where id = auth_row.patient_insurance_id and is_private = false;
  if not found then
    return new;
  end if;

  select * into price_row
  from insurer_price_tables
  where insurer_id = pi_row.insurer_id
    and procedure_code = auth_row.procedure_code
    and valid_from <= session_date
    and (valid_to is null or valid_to >= session_date)
  limit 1;

  if not found then
    return new;
  end if;

  insert into billing_periods (insurer_id, competence_month)
  values (pi_row.insurer_id, competence)
  on conflict (insurer_id, competence_month) do nothing;

  select id into period_id
  from billing_periods
  where insurer_id = pi_row.insurer_id and competence_month = competence;

  insert into billing_items (billing_period_id, appointment_id, procedure_code, amount, quantity)
  values (period_id, new.id, auth_row.procedure_code, price_row.price, 1)
  on conflict (appointment_id, procedure_code) do nothing;

  return new;
exception when others then
  raise warning 'bill_item_on_session_realizada: falha ao gerar billing_item para appointment %: %', new.id, sqlerrm;
  return new;
end;
$$;

-- =====================================================================
-- 3. Reserva do bloco de 2h pelo bot de WhatsApp
-- =====================================================================

-- Irmã de `book_intake_lead_slot_atomic` (20260907170006_insurance_intake.sql)
-- para o encaixe em turma: sala e horário vêm da turma (não são escolha do
-- responsável), a modalidade é 'grupo' e a sessão NÃO é avaliação. Lotação,
-- dia/horário e duração continuam sendo validados pelo trigger
-- `appointments_aba_training_guard` — aqui só traduzimos a exceção dele
-- numa mensagem que o bot possa mandar de volta pro responsável.
create function book_aba_training_slot_atomic(
  p_lead_id uuid,
  p_class_id uuid,
  p_therapist_id uuid,
  p_starts_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
  v_class aba_training_classes%rowtype;
  v_type appointment_types%rowtype;
  v_ends_at timestamptz;
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

  select * into v_class from aba_training_classes where id = p_class_id;
  if not found or not v_class.active then
    return jsonb_build_object('success', false, 'error', 'Essa turma não está mais disponível.');
  end if;

  select * into v_type from appointment_types
  where clinic_id = v_class.clinic_id and aba_role = 'treino' and active
  limit 1;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Tipo de atendimento Treino ABA não cadastrado.');
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_type.duration_minutes);

  begin
    insert into appointments (
      patient_id, therapist_id, room_id, discipline, appointment_type_id,
      starts_at, ends_at, modality, status, is_evaluation, aba_class_id
    ) values (
      v_lead.patient_id, p_therapist_id, v_class.room_id, v_type.name, v_type.id,
      p_starts_at, v_ends_at, 'grupo', 'agendada', false, p_class_id
    ) returning id into v_appointment_id;
  exception
    when others then
      if sqlerrm like '%lotada%' then
        return jsonb_build_object('success', false, 'error', 'Essa turma acabou de lotar. Escolha outro horário.');
      end if;
      if sqlerrm like '%já está nessa turma%' then
        return jsonb_build_object('success', false, 'error', 'Já existe um agendamento seu nessa turma nesse dia.');
      end if;
      return jsonb_build_object('success', false, 'error', 'Não foi possível reservar esse bloco. Escolha outro horário.');
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
    'ends_at', v_ends_at
  );
end;
$$;

revoke all on function book_aba_training_slot_atomic(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
