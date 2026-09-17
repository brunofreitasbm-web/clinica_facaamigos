-- supabase/migrations/20260917170200_contracts_billing_mode.sql
-- Diretriz de Atendimento Particular: a forma preferencial de cobrança é
-- pacote mensal adiantado (10 sessões/mês por padrão, fidelizando o cliente
-- e reduzindo faltas), mas cobrança avulsa por sessão continua permitida.
-- Estende patient_contracts/contract_invoices (20260908050000) em vez de
-- criar tabelas novas.
alter table patient_contracts
  add column if not exists billing_mode text not null default 'pacote' check (billing_mode in ('pacote','avulsa')),
  add column if not exists sessions_per_month int check (sessions_per_month between 1 and 60),
  add column if not exists specialty_value text,
  add column if not exists unit_price numeric(10,2),
  add column if not exists invoice_day int not null default 1 check (invoice_day between 1 and 28);

alter table contract_invoices
  add column if not exists reference_month date,
  add column if not exists description text,
  add column if not exists paid_method text,
  add column if not exists paid_by_name text;

-- Uma fatura por mês de competência e por contrato (generate_package_invoices
-- e a action generateMonthlyInvoice dependem desse índice para não duplicar).
create unique index if not exists contract_invoices_month_uq
  on contract_invoices (contract_id, reference_month) where reference_month is not null;

alter table patient_charges
  add column if not exists appointment_id uuid references appointments(id),
  add column if not exists paid_method text;

-- Cobrança avulsa: cada sessão realizada de um contrato billing_mode='avulsa'
-- vira uma cobrança individual, pelo preço da especialidade da sessão
-- (specialty_prices, 20260917170000). Dedupe por appointment_id — reexecutar
-- o mesmo appointment (ex.: correção de status) não duplica a cobrança.
create function appointments_avulsa_charge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_contract record;
  v_price numeric(10,2);
  v_patient_name text;
begin
  if new.status <> 'realizada' or (old.status is not distinct from new.status) then
    return new;
  end if;

  select pc.id, pc.clinic_id into v_contract
  from patient_contracts pc
  where pc.patient_id = new.patient_id
    and pc.status = 'ativo'
    and pc.billing_mode = 'avulsa'
  limit 1;

  if v_contract.id is null then
    return new;
  end if;

  if exists (select 1 from patient_charges where appointment_id = new.id) then
    return new;
  end if;

  select price into v_price
  from specialty_prices sp
  where sp.clinic_id = v_contract.clinic_id and sp.specialty_value = new.discipline and sp.active
  limit 1;

  if v_price is null then
    return new;
  end if;

  select full_name into v_patient_name from patients where id = new.patient_id;

  insert into patient_charges (patient_id, description, amount, status, due_date, appointment_id)
  values (
    new.patient_id,
    'Sessão avulsa — ' || coalesce(v_patient_name, '') || ' — ' || to_char(new.starts_at, 'DD/MM/YYYY'),
    v_price,
    'pendente',
    (new.starts_at at time zone 'America/Sao_Paulo')::date,
    new.id
  );

  return new;
exception when others then
  -- Cobrança avulsa nunca pode derrubar a confirmação de presença — mesma
  -- postura defensiva de appointments_group_overlap_guard/auto_resolve_appointments.
  raise warning 'appointments_avulsa_charge falhou para appointment %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke execute on function appointments_avulsa_charge() from public, anon, authenticated;

create trigger trg_appointments_avulsa_charge
  after update of status on appointments
  for each row execute function appointments_avulsa_charge();

-- Geração mensal das faturas de pacote (dia configurável por contrato via
-- invoice_day, mas o cron roda uma vez por mês e cada contrato calcula seu
-- próprio due_date — mesma lógica de generateMonthlyInvoice em
-- app/gestor/contratos/actions.ts, agora automatizada).
create function generate_package_invoices(p_month date default date_trunc('month', now() at time zone 'America/Sao_Paulo')::date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_due_date date;
  v_created int := 0;
begin
  for c in
    select id, unit_price, sessions_per_month, invoice_day
    from patient_contracts
    where status = 'ativo' and billing_mode = 'pacote'
      and unit_price is not null and sessions_per_month is not null
  loop
    v_due_date := least(
      (date_trunc('month', p_month) + (c.invoice_day - 1) * interval '1 day')::date,
      (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date
    );

    insert into contract_invoices (contract_id, due_date, amount, status, reference_month, description)
    values (
      c.id,
      v_due_date,
      c.unit_price * c.sessions_per_month,
      'pendente',
      date_trunc('month', p_month)::date,
      'Pacote mensal — ' || c.sessions_per_month || ' sessões — ' || to_char(p_month, 'MM/YYYY')
    )
    on conflict (contract_id, reference_month) where reference_month is not null do nothing;

    if found then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke execute on function generate_package_invoices(date) from public, anon, authenticated;

-- Agendamento: todo dia 1 às 06h, mesmo padrão isolado de
-- 20260906000015/20260906000016 — se pg_cron/pg_net não existirem neste
-- ambiente, a função continua disponível para chamada manual/rota Next.js.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'generate_package_invoices_monthly',
    '0 6 1 * *',
    $job$ select generate_package_invoices(); $job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — chame generate_package_invoices() manualmente. %', sqlerrm;
end;
$$;
