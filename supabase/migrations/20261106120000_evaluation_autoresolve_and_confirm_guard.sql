-- Avaliação realizada nunca volta a "aguardando confirmação" nem fica sem "avaliado".
--
-- 1) auto_resolve_appointments fazia o check-out automático da avaliação
--    (status 'realizada', is_provisional) mas não gravava patients.evaluated_at,
--    deixando o paciente "não avaliado" e a avaliação aparecendo como pendência.
-- 2) confirm_evaluation_offer sobrescrevia status/is_provisional de uma avaliação
--    já com check-in/realizada (status voltava a 'confirmada'), o que travava o
--    check-out automático e reabria o aviso de pendência.

create or replace function public.auto_resolve_appointments()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  attendance_grace_minutes constant int := 20;
  r record;
begin
  -- 1) Check-in feito, horário de término passado, sem check-out -> 'realizada'.
  for r in
    select id, patient_id, is_evaluation, is_provisional
    from appointments
    where status in ('agendada', 'confirmada')
      and checkin_at is not null
      and checkout_at is null
      and ends_at <= now()
  loop
    begin
      update appointments
      set checkout_at = ends_at,
          status = 'realizada',
          is_provisional = (r.is_evaluation or r.is_provisional),
          auto_marked = true
      where id = r.id;

      -- Check-out da 1ª avaliação = paciente avaliado (mesmo efeito do check-out manual).
      if r.is_evaluation and r.patient_id is not null then
        update patients
        set evaluated_at = now()
        where id = r.patient_id
          and evaluated_at is null;
      end if;
    exception when others then
      raise warning 'auto_resolve_appointments: check-out automático falhou para appointment %: %', r.id, sqlerrm;
    end;
  end loop;

  -- 2) Sem check-in decorrida a tolerância -> falta, exceto com chegada por QR
  -- em aberto.
  update appointments a
  set status = 'falta_familia',
      cancelled_at = now(),
      cancel_reason = null,
      cancelled_by = null,
      auto_marked = true
  where a.status in ('agendada', 'confirmada')
    and a.checkin_at is null
    and a.starts_at <= now() - (attendance_grace_minutes || ' minutes')::interval
    and not exists (
      select 1 from checkin_requests cr
      where cr.status = 'aguardando'
        and (cr.appointment_id = a.id or a.id = any(cr.candidate_appointment_ids))
    );
end;
$function$;

create or replace function public.confirm_evaluation_offer(p_offer_id uuid, p_confirmed_by uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_offer record;
  v_appt record;
begin
  select * into v_offer from evaluation_offers where id = p_offer_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Oferta não encontrada.');
  end if;

  if v_offer.status <> 'aguardando_supervisor' then
    return jsonb_build_object('success', false, 'error', 'Esta oferta não está aguardando confirmação.');
  end if;

  select * into v_appt from appointments where id = v_offer.appointment_id for update;

  if not found or v_appt.status in ('cancelada_familia', 'cancelada_terapeuta', 'cancelada_clinica', 'remarcada') then
    return jsonb_build_object('success', false, 'error', 'O agendamento desta oferta não está mais ativo.');
  end if;

  if v_appt.checkin_at is not null or v_appt.status = 'realizada' then
    -- A avaliação já aconteceu: só registra a confirmação, sem reabrir o agendamento.
    update appointments
    set confirmed_at = coalesce(confirmed_at, now()),
        confirmed_via = coalesce(confirmed_via, 'whatsapp_supervisor_ok')
    where id = v_appt.id;
  else
    update appointments
    set status = 'confirmada',
        is_provisional = false,
        confirmed_at = now(),
        confirmed_via = 'whatsapp_supervisor_ok'
    where id = v_appt.id;
  end if;

  update evaluation_offers
  set status = 'confirmado', confirmed_at = now(), confirmed_by = p_confirmed_by, updated_at = now()
  where id = p_offer_id;

  return jsonb_build_object('success', true, 'patient_id', v_offer.patient_id, 'appointment_id', v_offer.appointment_id);
end;
$function$;

-- Backfill: avaliações já com check-in e check-out cujo paciente ficou sem evaluated_at.
update patients p
set evaluated_at = a.checkout_at
from appointments a
where a.patient_id = p.id
  and a.is_evaluation
  and a.checkin_at is not null
  and a.checkout_at is not null
  and a.status in ('realizada', 'confirmada')
  and p.evaluated_at is null;
