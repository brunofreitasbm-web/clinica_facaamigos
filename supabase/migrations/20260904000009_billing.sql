-- Task 9: Faturamento — billing_periods, billing_items, glosas
-- Criação de tabelas de gestão de faturamento com policies RLS corrigidas

create table billing_periods (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id),
  competence_month date not null,
  status text not null default 'aberta' check (status in ('aberta','fechada','enviada','paga')),
  exported_at timestamptz,
  exported_file_id uuid
);

create table billing_items (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references billing_periods(id),
  appointment_id uuid not null references appointments(id),
  procedure_code text not null,
  amount numeric(10,2) not null,
  status text not null default 'pendente'
    check (status in ('pendente','enviado','pago','glosado','recursado','recuperado')),
  paid_at timestamptz
);

create table glosas (
  id uuid primary key default gen_random_uuid(),
  billing_item_id uuid not null references billing_items(id),
  reason_code text not null,
  reason_text text,
  attributable_to text not null check (attributable_to in ('terapeuta','recepcao','faturamento','operadora')),
  attributable_profile_id uuid references profiles(id),
  amount numeric(10,2) not null,
  appealed_at timestamptz,
  recovered_amount numeric(10,2)
);

alter table billing_periods enable row level security;
alter table billing_items enable row level security;
alter table glosas enable row level security;

create function billing_items_requires_session_note() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from appointments a where a.id = new.appointment_id and a.status = 'realizada') then
    raise exception 'billing_items só pode ser criado para appointment realizada';
  end if;
  if not exists (select 1 from session_notes sn where sn.appointment_id = new.appointment_id) then
    raise exception 'billing_items exige session_notes existente para appointment %', new.appointment_id;
  end if;
  return new;
end;
$$;

create trigger trg_billing_items_requires_session_note
  before insert on billing_items
  for each row execute function billing_items_requires_session_note();

-- CORRIGIDO: billing_periods_read agora faz join até clinic_id via insurers
create policy billing_periods_read on billing_periods for select
  using (
    app_current_role() in ('gestor','faturamento') and
    exists (select 1 from insurers i where i.id = insurer_id and i.clinic_id = current_clinic_id())
  );

-- CORRIGIDO: billing_periods_write agora faz join até clinic_id via insurers
create policy billing_periods_write on billing_periods for all
  using (
    app_current_role() in ('faturamento','gestor') and
    exists (select 1 from insurers i where i.id = insurer_id and i.clinic_id = current_clinic_id())
  );

-- CORRIGIDO: billing_items_read agora faz join até clinic_id via billing_periods -> insurers
create policy billing_items_read on billing_items for select
  using (
    app_current_role() in ('gestor','faturamento') and
    exists (
      select 1 from billing_periods bp
      join insurers i on i.id = bp.insurer_id
      where bp.id = billing_period_id and i.clinic_id = current_clinic_id()
    )
  );

-- CORRIGIDO: billing_items_write agora faz join até clinic_id via billing_periods -> insurers
create policy billing_items_write on billing_items for insert
  with check (
    app_current_role() in ('faturamento','gestor') and
    exists (
      select 1 from billing_periods bp
      join insurers i on i.id = bp.insurer_id
      where bp.id = billing_period_id and i.clinic_id = current_clinic_id()
    )
  );

-- CORRIGIDO: billing_items_update agora faz join até clinic_id via billing_periods -> insurers
create policy billing_items_update on billing_items for update
  using (
    app_current_role() in ('faturamento','gestor') and
    exists (
      select 1 from billing_periods bp
      join insurers i on i.id = bp.insurer_id
      where bp.id = billing_period_id and i.clinic_id = current_clinic_id()
    )
  );

-- CORRIGIDO: glosas_read agora faz join até clinic_id via billing_items -> billing_periods -> insurers
create policy glosas_read on glosas for select
  using (
    (
      app_current_role() in ('gestor','faturamento') and
      exists (
        select 1 from billing_items bi
        join billing_periods bp on bp.id = bi.billing_period_id
        join insurers i on i.id = bp.insurer_id
        where bi.id = billing_item_id and i.clinic_id = current_clinic_id()
      )
    )
    or (
      attributable_to = 'terapeuta' and attributable_profile_id = auth.uid()
    )
  );

-- CORRIGIDO: glosas_write agora faz join até clinic_id via billing_items -> billing_periods -> insurers
create policy glosas_write on glosas for all
  using (
    app_current_role() in ('faturamento','gestor') and
    exists (
      select 1 from billing_items bi
      join billing_periods bp on bp.id = bi.billing_period_id
      join insurers i on i.id = bp.insurer_id
      where bi.id = billing_item_id and i.clinic_id = current_clinic_id()
    )
  );
