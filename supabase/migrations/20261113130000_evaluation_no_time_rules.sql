-- 1ª avaliação não tem regra de horário: quem manda é o check-in da Recepção e o
-- check-out do terapeuta.
--
-- A agenda de 1ª avaliação não funciona com horário marcado rígido: a criança pode
-- chegar atrasada ou ser atendida fora do horário previsto. Por isso
-- auto_resolve_appointments deixa de mexer em avaliações (is_evaluation):
--   1) não faz mais o check-out automático no fim do horário (ends_at) — o
--      check-out é do terapeuta, e só ele marca a criança como avaliada;
--   2) não marca mais 'falta_familia' após a tolerância sem check-in — a falta de
--      uma avaliação é decisão da Recepção/Supervisão, nunca do relógio.
-- Sessões comuns continuam com as duas regras, idênticas à versão anterior
-- (20261106120000_evaluation_autoresolve_and_confirm_guard.sql).

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
  -- Avaliação fica de fora: o check-out é manual (terapeuta).
  for r in
    select id, is_provisional
    from appointments
    where status in ('agendada', 'confirmada')
      and checkin_at is not null
      and checkout_at is null
      and ends_at <= now()
      and is_evaluation is not true
  loop
    begin
      update appointments
      set checkout_at = ends_at,
          status = 'realizada',
          is_provisional = r.is_provisional,
          auto_marked = true
      where id = r.id;
    exception when others then
      raise warning 'auto_resolve_appointments: check-out automático falhou para appointment %: %', r.id, sqlerrm;
    end;
  end loop;

  -- 2) Sem check-in decorrida a tolerância -> falta, exceto com chegada por QR
  -- em aberto. Avaliação fica de fora: a Recepção decide, a criança pode só estar atrasada.
  update appointments a
  set status = 'falta_familia',
      cancelled_at = now(),
      cancel_reason = null,
      cancelled_by = null,
      auto_marked = true
  where a.status in ('agendada', 'confirmada')
    and a.checkin_at is null
    and a.is_evaluation is not true
    and a.starts_at <= now() - (attendance_grace_minutes || ' minutes')::interval
    and not exists (
      select 1 from checkin_requests cr
      where cr.status = 'aguardando'
        and (cr.appointment_id = a.id or a.id = any(cr.candidate_appointment_ids))
    );
end;
$function$;
