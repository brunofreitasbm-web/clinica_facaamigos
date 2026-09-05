-- Painel de gestão do paciente: tags livres, cobranças avulsas (particular,
-- fora do fluxo de faturamento por convênio em billing_items), status
-- "arquivado" e disciplina de exibição do profissional vinculado.

alter table patients drop constraint patients_status_check;
alter table patients add constraint patients_status_check
  check (status in ('lead','avaliacao','ativo','pausado','alta','evadido','arquivado'));

alter table profiles add column discipline text;

create table patient_tags (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  label text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Cobrança avulsa feita diretamente ao paciente/família (particular ou
-- copagamento) — distinta de `billing_items`, que é o lançamento de
-- reembolso por convênio dentro de um `billing_period` fechado.
create table patient_charges (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  description text not null,
  amount numeric(10,2) not null,
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  due_date date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table patient_tags enable row level security;
alter table patient_charges enable row level security;

create policy patient_tags_read on patient_tags for select
  using (
    exists (select 1 from patients pt where pt.id = patient_tags.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao','faturamento')
      or has_patient_access(patient_tags.patient_id, array['terapeuta','responsavel'])
    )
  );
create policy patient_tags_write on patient_tags for all
  using (
    exists (select 1 from patients pt where pt.id = patient_tags.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('recepcao','supervisor','gestor')
  );

create policy patient_charges_read on patient_charges for select
  using (
    exists (select 1 from patients pt where pt.id = patient_charges.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao','faturamento')
  );
create policy patient_charges_write on patient_charges for all
  using (
    exists (select 1 from patients pt where pt.id = patient_charges.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('recepcao','supervisor','gestor')
  );
