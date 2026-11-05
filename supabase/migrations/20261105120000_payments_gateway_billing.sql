-- Cobrança automática dos Pacotes de Sessões particulares (gateway Asaas: Pix Automático + boleto).
--
-- 1. Fecha o drift: billing_mode, invoice_day, unit_price, sessions_per_month, specialty_value (patient_contracts) e
--    reference_month, description (contract_invoices) eram usadas por 20261031234723 e por
--    lib/database.types.ts, mas nenhuma migration as criava. `add column if not exists` é
--    no-op onde já foram aplicadas à mão.
-- 2. Colunas do gateway (cliente, autorização Pix Automático, cobrança, valores pagos, régua).
-- 3. payment_events: idempotência e trilha de auditoria do webhook (o Asaas entrega "pelo menos uma vez").
-- 4. dunning_log: o que a régua já enviou a quem.
-- 5. Pré-pago: generate_package_invoices passa a gerar a competência SEGUINTE, vencendo no
--    `invoice_day` (padrão 25) do mês anterior. Contratos antigos com outro invoice_day mudam de
--    semântica (antes: dia dentro da própria competência); a clínica abre em dez/2026 e não há
--    contrato real em produção para migrar.
-- 6. mark_overdue_invoices(): pendente vencida vira atrasada (nada fazia isso).
-- 7. Agenda (pg_cron). As rotas HTTP usam o mesmo padrão de 20260921040000 (x-cron-secret lido do Vault).
-- 8. Linha PART-PLANO-PONTE (6 sessões, R$ 1.050, só Pix Automático) no catálogo do convênio "Particular".
--
-- RLS: patient_contracts e contract_invoices já são só do gestor (20260908060000_onda1_contracts_inventory_rls.sql);
-- este arquivo NÃO as altera. O webhook e as rotas de cron usam o service role.

-- ───────────────────────────── 1. drift ─────────────────────────────
alter table public.patient_contracts
  add column if not exists billing_mode text not null default 'pacote',
  add column if not exists invoice_day integer not null default 25,
  add column if not exists unit_price numeric(10,2),
  add column if not exists sessions_per_month integer,
  add column if not exists specialty_value text;

alter table public.contract_invoices
  add column if not exists reference_month date,
  add column if not exists description text;

create unique index if not exists contract_invoices_contract_month_key
  on public.contract_invoices (contract_id, reference_month)
  where reference_month is not null;

-- ───────────────────────────── 2. gateway ─────────────────────────────
alter table public.patient_contracts
  add column if not exists plan_code text,
  add column if not exists payment_method text not null default 'boleto',
  add column if not exists financial_responsible_name text,
  add column if not exists financial_responsible_cpf text,
  add column if not exists financial_responsible_email text,
  add column if not exists financial_responsible_phone text,
  add column if not exists gateway_customer_id text,
  add column if not exists pix_authorization_id text,
  add column if not exists pix_authorization_status text,
  add column if not exists pix_authorization_qr text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists needs_review_reason text;

alter table public.patient_contracts
  drop constraint if exists patient_contracts_payment_method_check,
  add constraint patient_contracts_payment_method_check
    check (payment_method in ('pix_automatico', 'boleto')),
  drop constraint if exists patient_contracts_ponte_pix_only_check,
  add constraint patient_contracts_ponte_pix_only_check
    check (plan_code is distinct from 'PART-PLANO-PONTE' or payment_method = 'pix_automatico') not valid;

alter table public.contract_invoices
  add column if not exists payment_method text,
  add column if not exists gateway_charge_id text,
  add column if not exists gateway_status text,
  add column if not exists paid_amount numeric(10,2),
  add column if not exists net_amount numeric(10,2),
  add column if not exists fine_interest_amount numeric(10,2),
  add column if not exists nfse_id text,
  add column if not exists last_dunning_step text,
  add column if not exists last_dunning_at timestamptz;

create unique index if not exists contract_invoices_gateway_charge_key
  on public.contract_invoices (gateway_charge_id)
  where gateway_charge_id is not null;

create index if not exists patient_contracts_pix_authorization_idx
  on public.patient_contracts (pix_authorization_id)
  where pix_authorization_id is not null;

-- ───────────────────────────── 3. payment_events ─────────────────────────────
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  gateway_event_id text not null,
  event_type text not null,
  invoice_id uuid references public.contract_invoices(id) on delete set null,
  contract_id uuid references public.patient_contracts(id) on delete set null,
  actor_id uuid,
  note text,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (gateway, gateway_event_id)
);

create index if not exists payment_events_invoice_idx on public.payment_events (invoice_id);
create index if not exists payment_events_contract_idx on public.payment_events (contract_id);

alter table public.payment_events enable row level security;

drop policy if exists payment_events_read on public.payment_events;
create policy payment_events_read on public.payment_events
  for select using (
    app_current_role() = 'gestor'
    and (
      contract_id in (select id from public.patient_contracts where clinic_id = current_clinic_id())
      or invoice_id in (
        select ci.id from public.contract_invoices ci
        join public.patient_contracts pc on pc.id = ci.contract_id
        where pc.clinic_id = current_clinic_id()
      )
    )
  );
-- Sem policy de escrita: só o service role (webhook/rotas) grava.

-- ───────────────────────────── 4. dunning_log ─────────────────────────────
create table if not exists public.dunning_log (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.contract_invoices(id) on delete cascade,
  step text not null,
  channel text not null check (channel in ('whatsapp', 'email', 'task')),
  result text not null,
  detail text,
  sent_at timestamptz not null default now()
);

create index if not exists dunning_log_invoice_idx on public.dunning_log (invoice_id, sent_at desc);

alter table public.dunning_log enable row level security;

drop policy if exists dunning_log_read on public.dunning_log;
create policy dunning_log_read on public.dunning_log
  for select using (
    app_current_role() = 'gestor'
    and invoice_id in (
      select ci.id from public.contract_invoices ci
      join public.patient_contracts pc on pc.id = ci.contract_id
      where pc.clinic_id = current_clinic_id()
    )
  );

-- ───────────────────────────── 5. pré-pago ─────────────────────────────
drop function if exists public.generate_package_invoices(date);

create or replace function public.generate_package_invoices(
  p_month date default (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month')::date
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
  v_competence date := date_trunc('month', p_month)::date;
  v_prev_month_start date := (date_trunc('month', p_month) - interval '1 month')::date;
  v_prev_month_end date := (date_trunc('month', p_month) - interval '1 day')::date;
  v_due_date date;
  v_created int := 0;
  v_amount numeric(10,2);
begin
  for c in
    select id, monthly_fee, unit_price, sessions_per_month, invoice_day, payment_method
    from patient_contracts
    where status = 'ativo' and billing_mode = 'pacote'
      and (monthly_fee > 0 or (unit_price is not null and sessions_per_month is not null))
  loop
    v_amount := case when c.monthly_fee > 0 then c.monthly_fee else c.unit_price * c.sessions_per_month end;
    -- Pré-pago: vence no invoice_day do mês ANTERIOR à competência (limitado ao fim desse mês).
    v_due_date := least(
      (v_prev_month_start + (greatest(c.invoice_day, 1) - 1) * interval '1 day')::date,
      v_prev_month_end
    );

    insert into contract_invoices (contract_id, due_date, amount, status, reference_month, description, payment_method)
    values (
      c.id,
      v_due_date,
      v_amount,
      'pendente',
      v_competence,
      case
        when c.sessions_per_month is not null
          then 'Pacote de sessões — ' || c.sessions_per_month || ' sessões — ' || to_char(v_competence, 'MM/YYYY')
        else 'Pacote de sessões — ' || to_char(v_competence, 'MM/YYYY')
      end,
      c.payment_method
    )
    on conflict (contract_id, reference_month) where reference_month is not null do nothing;

    if found then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$function$;

revoke all on function public.generate_package_invoices(date) from public, anon, authenticated;

-- ───────────────────────────── 6. atraso ─────────────────────────────
create or replace function public.mark_overdue_invoices() returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n int;
begin
  update contract_invoices
     set status = 'atrasado'
   where status = 'pendente'
     and due_date < (now() at time zone 'America/Sao_Paulo')::date;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke all on function public.mark_overdue_invoices() from public, anon, authenticated;

-- ───────────────────────────── 7. agenda ─────────────────────────────
-- Horários em UTC (São Paulo = UTC−3, sem horário de verão).
do $migration$
declare
  base_url constant text := 'https://sistema.institutofacaamigos.com.br';
  job record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ausente: jobs de cobrança não agendados.';
    return;
  end if;

  for job in select jobname from cron.job where jobname in (
    'billing-generate-invoices', 'billing-mark-overdue', 'billing-emit', 'billing-dunning'
  ) loop
    perform cron.unschedule(job.jobname);
  end loop;

  -- Dia 10, 08:00 em SP: gera as faturas da competência seguinte.
  perform cron.schedule('billing-generate-invoices', '0 11 10 * *', 'select public.generate_package_invoices();');
  -- Todo dia, 08:30 em SP: pendente vencida vira atrasada.
  perform cron.schedule('billing-mark-overdue', '30 11 * * *', 'select public.mark_overdue_invoices();');

  perform cron.schedule('billing-emit', '0 12 * * *', format($cmd$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
      ),
      body := '{}'::jsonb
    );
  $cmd$, base_url || '/api/billing/emit'));

  perform cron.schedule('billing-dunning', '30 12 * * *', format($cmd$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
      ),
      body := '{}'::jsonb
    );
  $cmd$, base_url || '/api/billing/dunning'));
end
$migration$;

-- ───────────────────────────── 8. catálogo: Pacote Ponte ─────────────────────────────
-- A observação precisa começar com "<n> sessões" (lib/particular-plans-pure.ts, sessionsFromNote).
insert into public.insurer_price_tables (
  insurer_id, procedure_code, procedure_name, price, duration_minutes,
  requires_prior_authorization, max_sessions_per_guide, session_frequency_note, valid_from
)
select i.id, 'PART-PLANO-PONTE', 'Pacote Ponte', 1050.00, 40, false, null,
       '6 sessões/mês (2 por semana em 3 semanas; a 4ª semana fica para reposição e feriado). Exclusivo do Pix Automático.',
       date '2026-11-05'
from public.insurers i
where i.name = 'Particular'
  and not exists (
    select 1 from public.insurer_price_tables p
    where p.insurer_id = i.id and p.procedure_code = 'PART-PLANO-PONTE'
  );
