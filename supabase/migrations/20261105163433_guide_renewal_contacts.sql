-- Registro de "responsável acionado para renovar a guia": cada clique em "Renovar guia"
-- (card "Guias vencendo ou acabando" da home da recepção) grava uma linha. Serve para a
-- recepção não acionar a mesma família duas vezes (app/recepcao/renew-guide-actions.ts).

create table guide_renewal_contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  contacted_by uuid references profiles(id) on delete set null,
  contacted_at timestamptz not null default now()
);

create index guide_renewal_contacts_patient_idx on guide_renewal_contacts (patient_id, contacted_at desc);
create index guide_renewal_contacts_clinic_idx on guide_renewal_contacts (clinic_id);
create index guide_renewal_contacts_contacted_by_idx on guide_renewal_contacts (contacted_by);

alter table guide_renewal_contacts enable row level security;

create policy guide_renewal_contacts_read on guide_renewal_contacts for select
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));
create policy guide_renewal_contacts_insert on guide_renewal_contacts for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['gestor','supervisor','recepcao'])
              and exists (select 1 from patients pt where pt.id = patient_id and pt.clinic_id = (select current_clinic_id())));
