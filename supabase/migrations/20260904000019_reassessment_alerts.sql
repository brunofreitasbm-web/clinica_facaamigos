-- supabase/migrations/20260904000019_reassessment_alerts.sql
-- Item 2 do PRD "11 incrementos": ciclo de reavaliação semestral. Data de
-- admissão = patients.first_session_at (já existe — marcado por
-- activatePatient ao montar a 1ª sessão da grade). due_date = admissão + 6
-- meses; o alerta "acende" `alert_window_days` antes disso.

create table reassessment_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  due_date date not null,
  alert_window_days int not null default 30,
  status text not null default 'pendente' check (status in ('pendente','notificado','concluido')),
  created_at timestamptz not null default now(),
  unique (patient_id, due_date)
);

-- Índice parcial: só o que a rotina diária (refresh_reassessment_alerts)
-- precisa varrer para decidir quem notificar.
create index reassessment_alerts_pending_idx on reassessment_alerts (due_date) where status = 'pendente';

alter table reassessment_alerts enable row level security;

create policy reassessment_alerts_read on reassessment_alerts for select
  using (
    exists (select 1 from patients pt where pt.id = reassessment_alerts.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor')
      or has_patient_access(reassessment_alerts.patient_id, array['terapeuta'])
    )
  );

-- "concluído" é a única transição manual (terapeuta/supervisor confirma que
-- a reavaliação global aconteceu) — pendente/notificado são geridos só pela
-- rotina abaixo, por isso não há policy de insert para papéis de aplicação.
create policy reassessment_alerts_update on reassessment_alerts for update
  using (
    exists (select 1 from patients pt where pt.id = reassessment_alerts.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor')
      or has_patient_access(reassessment_alerts.patient_id, array['terapeuta'])
    )
  );

-- security definer (mesmo padrão de current_clinic_id/fn_audit_log): roda
-- via pg_cron sem sessão de usuário autenticado, então precisa escrever em
-- reassessment_alerts/messages de todas as clínicas independente de RLS.
create function refresh_reassessment_alerts() returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  -- 1) garante 1 alerta por paciente ativo/admitido, calculado a partir de
  -- first_session_at. on conflict faz desta função idempotente rodando
  -- todo dia sem duplicar linha.
  insert into reassessment_alerts (patient_id, due_date)
  select p.id, (p.first_session_at::date + interval '6 months')::date
  from patients p
  where p.status = 'ativo' and p.first_session_at is not null
  on conflict (patient_id, due_date) do nothing;

  -- 2) notifica (grava mensagem no canal portal) os alertas pendentes que
  -- entraram na janela de antecedência.
  for r in
    select ra.id, ra.patient_id, ra.due_date
    from reassessment_alerts ra
    where ra.status = 'pendente'
      and ra.due_date - (ra.alert_window_days || ' days')::interval <= now()
  loop
    insert into messages (patient_id, channel, direction, template_key, body, sent_at)
    values (
      r.patient_id,
      'portal',
      'outbound',
      'reavaliacao_semestral',
      'Reavaliação semestral prevista para ' || to_char(r.due_date, 'DD/MM/YYYY') || '.',
      now()
    );
    update reassessment_alerts set status = 'notificado' where id = r.id;
  end loop;
end;
$$;

-- pg_cron é a extensão gerenciada pelo Supabase para jobs agendados — evita
-- introduzir um worker Node separado só para este cálculo diário. Se o
-- ambiente não tiver pg_cron disponível (ex.: Postgres local sem a
-- extensão), este bloco falha isolado sem impedir o resto da migration.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'refresh_reassessment_alerts_daily',
    '0 6 * * *',
    $job$select refresh_reassessment_alerts();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende refresh_reassessment_alerts() externamente. %', sqlerrm;
end;
$$;
