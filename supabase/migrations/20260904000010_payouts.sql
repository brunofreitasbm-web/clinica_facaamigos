-- supabase/migrations/20260904000010_payouts.sql
create table payouts (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references profiles(id),
  competence_month date not null,
  sessions_count int not null default 0,
  gross_amount numeric(10,2) not null default 0,
  adjustments numeric(10,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto','aprovado','pago')),
  unique (therapist_id, competence_month)
);

create table payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references payouts(id),
  appointment_id uuid not null references appointments(id),
  rate_applied numeric(10,2) not null
);

alter table payouts enable row level security;
alter table payout_items enable row level security;

-- payouts_read: Allow gestores/faturamento within same clinic, or therapist reading own payouts
create policy payouts_read on payouts for select
  using (
    (app_current_role() in ('gestor','faturamento')
     and exists (select 1 from profiles p where p.id = payouts.therapist_id and p.clinic_id = current_clinic_id()))
    or therapist_id = auth.uid()
  );

-- payouts_write: Allow only gestores of same clinic as therapist
create policy payouts_write on payouts for all
  using (
    app_current_role() = 'gestor'
    and exists (select 1 from profiles p where p.id = payouts.therapist_id and p.clinic_id = current_clinic_id())
  );

-- payout_items_read: Allow gestores/faturamento within same clinic, or therapist reading items from own payouts
create policy payout_items_read on payout_items for select
  using (
    (app_current_role() in ('gestor','faturamento')
     and exists (select 1 from payouts p
                 join profiles pr on pr.id = p.therapist_id
                 where p.id = payout_items.payout_id and pr.clinic_id = current_clinic_id()))
    or exists (select 1 from payouts p where p.id = payout_items.payout_id and p.therapist_id = auth.uid())
  );

-- payout_items_write: Allow only gestores of same clinic
create policy payout_items_write on payout_items for all
  using (
    app_current_role() = 'gestor'
    and exists (select 1 from payouts p
                join profiles pr on pr.id = p.therapist_id
                where p.id = payout_items.payout_id and pr.clinic_id = current_clinic_id())
  );
