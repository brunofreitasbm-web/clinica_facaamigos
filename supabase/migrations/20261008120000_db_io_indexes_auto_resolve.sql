-- supabase/migrations/20261008120000_db_io_indexes_auto_resolve.sql
--
-- Incidente de Disk I/O (2026-10-08, ver docs/runbooks/db-io-incident-2026-10-08.md).
-- auto_resolve_appointments() roda a cada 5 min (288x/dia) e `appointments`
-- não tinha índice para os filtros dela (status/checkin_at/starts_at/ends_at)
-- -> seq scan por execução. audit_log não tinha índice em `at`, necessário
-- para a retenção (migration 20261008120100).
--
-- ATENÇÃO (locks): `CREATE INDEX` simples bloqueia ESCRITAS na tabela durante
-- a construção (leituras seguem). Migrations do Supabase rodam em transação,
-- então CREATE INDEX CONCURRENTLY não é possível aqui. `lock_timeout` abaixo
-- faz a migration FALHAR rápido em vez de enfileirar atrás de uma transação
-- longa e travar o sistema inteiro. Se `appointments` ou, principalmente,
-- `audit_log` estiverem grandes, crie os índices ANTES, manualmente e FORA de
-- transação (SQL Editor, um comando por vez), com os MESMOS nomes:
--
--   create index concurrently if not exists idx_appointments_status_starts_at
--     on public.appointments (status, starts_at);
--   create index concurrently if not exists idx_appointments_open_starts_at
--     on public.appointments (starts_at)
--     where status in ('agendada','confirmada') and checkin_at is null;
--   create index concurrently if not exists idx_appointments_open_checkin_ends_at
--     on public.appointments (ends_at)
--     where status in ('agendada','confirmada') and checkin_at is not null and checkout_at is null;
--   create index concurrently if not exists idx_audit_log_at on public.audit_log (at);
--
-- Como esta migration usa IF NOT EXISTS, ela vira no-op para o que já existir.
-- (Se um CONCURRENTLY falhar no meio, sobra índice INVALID: dropar e refazer.)

set local lock_timeout = '5s';

-- Uso geral (agenda, painéis) e base para filtros por status + janela.
create index if not exists idx_appointments_status_starts_at
  on public.appointments (status, starts_at);

-- Ramo 2 do auto_resolve (falta automática): só linhas ainda em aberto e sem
-- check-in. Predicado seletivo: a imensa maioria das linhas é realizada/cancelada.
create index if not exists idx_appointments_open_starts_at
  on public.appointments (starts_at)
  where status in ('agendada', 'confirmada') and checkin_at is null;

-- Ramo 1 do auto_resolve (check-out automático): check-in feito, sem check-out.
create index if not exists idx_appointments_open_checkin_ends_at
  on public.appointments (ends_at)
  where status in ('agendada', 'confirmada')
    and checkin_at is not null
    and checkout_at is null;

-- Coluna real é `at` (não created_at) — ver 20260904000012_audit_and_messages.sql.
create index if not exists idx_audit_log_at
  on public.audit_log (at);

-- Mesma lógica de 20260908040001, com UMA mudança: a tolerância de 20 min
-- passa de `starts_at + interval <= now()` (não usa índice em starts_at) para
-- `starts_at <= now() - interval` (equivalente, indexável). Semântica idêntica.
-- create or replace preserva grants (execute já revogado de public/anon/authenticated).
create or replace function auto_resolve_appointments() returns void
language plpgsql security definer set search_path = public as $$
declare
  attendance_grace_minutes constant int := 20;
  r record;
begin
  -- 1) Check-in feito, horário de término passado, sem check-out -> 'realizada'.
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

  -- 2) Sem check-in decorrida a tolerância -> falta, exceto com chegada por QR
  -- em aberto (ver comentários em 20260908040001).
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
$$;
