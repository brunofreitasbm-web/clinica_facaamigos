-- supabase/migrations/20260906000017_pending_queue_assignments.sql
-- §9.1 hoje é só uma lista calculada on-demand (lib/reception-queue.ts,
-- getReceptionQueue): nenhum item tem dono nem prazo, e nada escala se
-- ninguém tocar — item some da lista quando resolvido, mas fica invisível
-- pra sempre se ninguém olhar a tela. Esta migration dá dono + prazo a cada
-- item e escala quando estoura o prazo.
--
-- `item_id` guarda exatamente a mesma string usada como `PendingQueueItem.id`
-- em cada `items.push(...)` de lib/reception-queue.ts (ex.:
-- `guia-vence-<patientId>-<validTo>`, `falta-auto-<appointmentId>`) — é assim
-- que uma linha aqui bate 1:1 com um item da fila calculada na hora, sem
-- precisar migrar a fila inteira (que hoje é derivada de 5 tabelas diferentes)
-- para uma tabela de fato.
create table pending_queue_assignments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  item_id text not null,
  category text not null check (category in (
    'guia_vencendo', 'guia_poucas_sessoes', 'cadastro_incompleto',
    'evolucao_atrasada', 'documento_vencido', 'lead_sem_retorno', 'falta_sem_motivo'
  )),
  -- nullable: evolucao_atrasada hoje não carrega patientId (ver
  -- PendingQueueItem.patientId em lib/reception-queue.ts) — o item existe,
  -- mas não aponta pra um paciente específico.
  patient_id uuid references patients(id),
  assigned_to uuid references profiles(id),
  due_at timestamptz not null,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (clinic_id, item_id)
);

-- Índice parcial: só o que a rotina de escalação (escalate_overdue_queue_items)
-- e as telas de recepção/gestor precisam varrer — itens ainda abertos e
-- ainda não escalados.
create index pending_queue_assignments_overdue_idx on pending_queue_assignments (due_at)
  where escalated_at is null and resolved_at is null;

alter table pending_queue_assignments enable row level security;

-- Mesmo conjunto de papéis operacionais de absence_alerts/messages: quem
-- trabalha a fila (recepção) e quem supervisiona/gerencia.
create policy pending_queue_assignments_read on pending_queue_assignments for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'));

create policy pending_queue_assignments_insert on pending_queue_assignments for insert
  with check (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'));

-- update cobre tanto a atribuição automática (getReceptionQueue faz upsert
-- de assigned_to/due_at quando o item ainda não tem dono) quanto a
-- reatribuição manual e o "resolver" na UI — escalated_at só é escrito pela
-- rotina security definer abaixo, que não passa por RLS de sessão de usuário.
create policy pending_queue_assignments_update on pending_queue_assignments for update
  using (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'));

-- Reaproveita o trigger genérico de audit_log (fn_audit_log, ver
-- 20260904000012_audit_and_messages.sql) em vez de gravar em `messages`:
-- `messages` é o canal família (app/familia/page.tsx lê essa tabela direto
-- pro portal da família, e patient_id é NOT NULL lá — evolucao_atrasada nem
-- teria pra quem apontar), então uma nota interna de escalação ali vazaria
-- pra família ou não teria patient_id pra gravar. audit_log já é lido só por
-- gestor (audit_log_read, mesma migration acima) — exatamente quem deve
-- saber que um item estourou o prazo sem ninguém agir. Ao dar
-- `escalated_at = now()` (rotina abaixo), o UPDATE já vira uma linha nova em
-- audit_log automaticamente, sem código extra.
create trigger trg_audit_pending_queue_assignments after insert or update or delete on pending_queue_assignments
  for each row execute function fn_audit_log();

-- security definer (mesmo padrão de refresh_reassessment_alerts /
-- auto_resolve_appointments): roda via pg_cron sem sessão de usuário
-- autenticado, precisa ler/atualizar itens de todas as clínicas
-- independente de RLS.
create function escalate_overdue_queue_items() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_escalated int;
begin
  update pending_queue_assignments
  set escalated_at = now()
  where due_at < now()
    and escalated_at is null
    and resolved_at is null;

  get diagnostics v_escalated = row_count;
  return v_escalated;
end;
$$;

revoke execute on function escalate_overdue_queue_items() from public, anon, authenticated;

-- pg_cron a cada hora: o prazo mais curto entre as categorias é 1h (lead sem
-- retorno — ver DUE_MINUTES_BY_CATEGORY em lib/reception-queue.ts), então
-- rodar de hora em hora escala no máximo ~1h depois do vencimento, sem gerar
-- carga perceptível (índice parcial acima mantém a varredura pequena). Se o
-- ambiente não tiver pg_cron (ex.: Postgres local sem a extensão), este
-- bloco falha isolado sem impedir o resto da migration — mesmo padrão de
-- refresh_reassessment_alerts_daily/auto_resolve_appointments_5min.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'escalate_overdue_queue_items_hourly',
    '0 * * * *',
    $job$select escalate_overdue_queue_items();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende escalate_overdue_queue_items() externamente. %', sqlerrm;
end;
$$;
