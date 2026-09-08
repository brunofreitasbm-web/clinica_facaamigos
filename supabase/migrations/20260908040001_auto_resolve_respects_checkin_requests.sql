-- supabase/migrations/20260908040001_auto_resolve_respects_checkin_requests.sql
--
-- Sem esta migration, o check-in por QR (checkin_requests, 20260908040000)
-- criaria a pior falha possível do recurso: a família chega, escaneia, senta
-- na sala de espera esperando ser chamada — e 20 minutos depois
-- auto_resolve_appointments() marca falta_familia mesmo assim, porque o QR
-- de propósito não grava checkin_at (ver o comentário no topo de
-- 20260908040000_checkin_requests.sql). Isso puniria a família, tiraria a
-- sessão do faturamento/repasse do terapeuta e ainda alimentaria
-- patient_absence_stats/o alerta de evasão contra alguém que compareceu.
--
-- O ramo de check-out automático (1) não muda: só age sobre checkin_at
-- preenchido, e o QR nunca grava checkin_at — só checkIn() em
-- app/recepcao/agenda/session-actions.ts grava, chamado por um humano.
create or replace function auto_resolve_appointments() returns void
language plpgsql security definer set search_path = public as $$
declare
  attendance_grace_minutes constant int := 20;
  r record;
begin
  -- 1) Check-in feito, horário de término passado, sem check-out ainda ->
  -- fecha como 'realizada'. Idêntico ao original (20260906000016).
  for r in
    select id, is_evaluation, is_provisional
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
    exception when others then
      raise warning 'auto_resolve_appointments: check-out automático falhou para appointment %: %', r.id, sqlerrm;
    end;
  end loop;

  -- 2) Sem check-in decorrida a tolerância -> falta com motivo pendente,
  -- EXCETO quando existe uma chegada declarada pelo QR ainda em aberto para
  -- esta sessão (cr.appointment_id) ou para uma das sessões candidatas em
  -- caso de ambiguidade (cr.candidate_appointment_ids — gêmeos/irmãos, ver
  -- checkin_requests.match_quality='ambiguo'). Nesse caso a família está
  -- fisicamente na clínica e só falta o clique da recepção; marcar falta
  -- aqui seria punir a família por uma omissão da recepção. A pendência fica
  -- visível no painel de chegadas (app/recepcao/chegadas) e, se ninguém
  -- resolver, expire_stale_checkin_requests() (abaixo) a encerra em 3h — aí
  -- sim a falta acontece no ciclo seguinte, com o rastro da chegada
  -- preservado para a recepção preencher o motivo com conhecimento de causa.
  --
  -- Um falso-negativo aqui (uma falta real que espera até 3h para ser
  -- marcada) é muito mais barato que o falso-positivo (falta indevida contra
  -- quem compareceu), daí a checagem intencionalmente conservadora com ANY.
  update appointments a
  set status = 'falta_familia',
      cancelled_at = now(),
      cancel_reason = null,
      cancelled_by = null,
      auto_marked = true
  where a.status in ('agendada', 'confirmada')
    and a.checkin_at is null
    and a.starts_at + (attendance_grace_minutes || ' minutes')::interval <= now()
    and not exists (
      select 1 from checkin_requests cr
      where cr.status = 'aguardando'
        and (cr.appointment_id = a.id or a.id = any(cr.candidate_appointment_ids))
    );
end;
$$;

-- Uma chegada pendente não pode segurar a falta para sempre — se a recepção
-- nunca resolver, expira em 3h (folga generosa acima da duração de qualquer
-- sessão) e a falta volta a poder ser marcada no ciclo seguinte de
-- auto_resolve_appointments. Também limpa chegadas que sobraram do dia
-- anterior (troca de plantão sem fechar o painel).
create function expire_stale_checkin_requests() returns void
language sql security definer set search_path = public as $$
  update checkin_requests
  set status = 'expirado',
      resolved_at = now(),
      resolution_note = 'expirada automaticamente sem confirmação da recepção'
  where status = 'aguardando'
    and (
      created_at < now() - interval '3 hours'
      or service_date < (now() at time zone 'America/Sao_Paulo')::date
    );
$$;

revoke execute on function expire_stale_checkin_requests() from public, anon, authenticated;

-- Agendada no mesmo ciclo de 5 min de auto_resolve_appointments_5min, e
-- registrada ANTES dela no schedule por nome (pg_cron não garante ordem
-- entre jobs distintos no mesmo tick, mas expirar cedo é sempre seguro:
-- uma chegada expirada só libera a falta a acontecer, nunca cria uma).
do $$
begin
  perform cron.schedule(
    'expire_checkin_requests_5min',
    '*/5 * * * *',
    $job$select expire_stale_checkin_requests();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende expire_stale_checkin_requests() externamente. %', sqlerrm;
end;
$$;
