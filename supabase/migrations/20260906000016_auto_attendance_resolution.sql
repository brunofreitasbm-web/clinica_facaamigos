-- supabase/migrations/20260906000016_auto_attendance_resolution.sql
-- Baixa automática de presença: hoje `status` só sai de 'agendada'/
-- 'confirmada' quando alguém clica (check-out da recepção/terapeuta, ou
-- "marcar falta" manual — app/recepcao/agenda/session-actions.ts e
-- app/terapeuta/session-actions.ts). Se ninguém clicar, a sessão fica presa
-- em 'agendada' pra sempre e não alimenta faturamento (app/faturamento/
-- competencias/actions.ts filtra status='realizada'), repasse
-- (app/faturamento/repasses/actions.ts, app/terapeuta/repasse/data.ts,
-- ambos `.eq("status", "realizada")`) nem o alerta de faltas repetidas
-- (patient_absence_stats em 20260906000015_absence_alerts.sql, que só olha
-- status in ('realizada','falta_familia')). Esta rotina fecha esse buraco:
--
--  1) Check-in feito (checkin_at) e horário de término já passou (ends_at)
--     sem check-out -> auto check-out, status='realizada' (mesmo efeito do
--     botão de check-out manual, incluindo is_provisional pra sessão de
--     avaliação — appointments_authorization_guard continua validando a
--     guia normalmente).
--  2) Sem check-in até ATTENDANCE_GRACE_MINUTES depois do início -> falta,
--     mas SEM motivo (cancel_reason fica null) — a recepção preenche o
--     motivo depois (fila de pendências, categoria nova "falta sem
--     motivo"). Documentar o motivo continua manual porque só um humano
--     sabe se foi doença, transporte etc.; o que este código automatiza é
--     não deixar a sessão flutuando sem status nenhum.
--
-- Ambas as transições gravam auto_marked=true pra distinguir de uma marcação
-- humana (a UI usa isso pra sinalizar "confira" e pra alimentar a fila de
-- pendências) e pra permitir desfazer só o que foi automático (ver
-- undoAutoFalta em app/recepcao/agenda/session-actions.ts) sem mexer em
-- faltas/realizadas que a recepção decidiu de propósito.
alter table appointments add column auto_marked boolean not null default false;

-- Tolerância entre o início da sessão e a falta automática: dá tempo de um
-- atraso pequeno sem já gerar falta, mas não deixa a sessão indefinida.
-- Mesma ordem de grandeza do "lead sem retorno > 15 min" (lib/reception-
-- queue.ts) — não há uma constante de app compartilhada entre SQL e
-- TypeScript hoje, então o valor é redeclarado aqui com o comentário como
-- única fonte de verdade.
--
-- security definer (mesmo padrão de refresh_reassessment_alerts /
-- close_monthly_metric_snapshots): roda via pg_cron sem sessão de usuário
-- autenticado, então precisa escrever em appointments de todas as clínicas
-- independente de RLS.
create function auto_resolve_appointments() returns void
language plpgsql security definer set search_path = public as $$
declare
  attendance_grace_minutes constant int := 20;
  r record;
begin
  -- 1) Check-in feito, horário de término passado, sem check-out ainda ->
  -- fecha como 'realizada'. Processada linha a linha (não em bulk UPDATE)
  -- porque appointments_authorization_guard pode rejeitar uma sessão sem
  -- guia válida (mesmo risco que já existe no check-out manual — ver
  -- mapAuthorizationGuardError) e uma linha problemática não pode travar
  -- as demais nem impedir a rotina de rodar no próximo ciclo.
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

  -- 2) Sem check-in decorrida a tolerância -> falta com motivo pendente.
  -- Sem trigger de status='realizada' envolvido, então um UPDATE em lote é
  -- seguro (nada aqui aciona appointments_authorization_guard).
  update appointments
  set status = 'falta_familia',
      cancelled_at = now(),
      cancel_reason = null,
      cancelled_by = null,
      auto_marked = true
  where status in ('agendada', 'confirmada')
    and checkin_at is null
    and starts_at + (attendance_grace_minutes || ' minutes')::interval <= now();
end;
$$;

revoke execute on function auto_resolve_appointments() from public, anon, authenticated;

-- pg_cron: mesmo desenho de refresh_reassessment_alerts_daily /
-- dispatch_nps_surveys. A cada 5 minutos é frequente o bastante pra falta
-- automática não atrasar muito o alerta de evasão e pro check-out
-- automático não segurar o faturamento por horas, sem gerar carga
-- perceptível (a query tem índice natural em status/checkin_at/starts_at
-- através do volume baixo de linhas em aberto por clínica).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'auto_resolve_appointments_5min',
    '*/5 * * * *',
    $job$select auto_resolve_appointments();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende auto_resolve_appointments() externamente. %', sqlerrm;
end;
$$;
