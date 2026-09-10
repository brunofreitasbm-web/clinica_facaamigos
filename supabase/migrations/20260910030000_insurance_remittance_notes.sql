-- Notas (demonstrativos de pagamento) dos planos de saúde: o outro lado da
-- DRE. Hoje a receita da DRE vem de `v_contribution_margin`, que é o que a
-- clínica FATUROU; a nota do plano é o que o plano diz que vai PAGAR — os dois
-- números não batem (glosa, corte de sessão, competência deslocada). Este
-- módulo guarda a nota linha a linha, com um marcador por linha (`consolidated`)
-- para o gestor escolher quais recebíveis entram na DRE.
--
-- O arquivo em si não é armazenado: ele é lido por scripts/parse_notas_planos.py
-- (pdfplumber/openpyxl) no momento do upload e só as linhas ficam.

create table insurance_remittance_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  insurer_id uuid references insurers(id) on delete set null,
  insurer_name text,
  file_name text not null,
  competence_month date not null,
  line_count integer not null default 0,
  total_gross numeric(12, 2) not null default 0,
  total_glosa numeric(12, 2) not null default 0,
  total_net numeric(12, 2) not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index insurance_remittance_batches_clinic_idx
  on insurance_remittance_batches (clinic_id, competence_month desc);

create table insurance_remittance_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references insurance_remittance_batches(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  competence_month date not null,
  guide_number text,
  patient_name text,
  procedure_code text,
  sessions integer,
  gross_amount numeric(12, 2),
  glosa_amount numeric(12, 2),
  net_amount numeric(12, 2) not null,
  service_date date,
  -- true quando a linha veio do texto corrido do PDF (sem tabela reconhecida):
  -- os valores podem estar em coluna trocada e precisam de conferência.
  low_confidence boolean not null default false,
  raw_line text,
  -- o checkbox da tela: só linha consolidada entra na receita da DRE.
  consolidated boolean not null default false,
  created_at timestamptz not null default now()
);

create index insurance_remittance_lines_batch_idx on insurance_remittance_lines (batch_id);
create index insurance_remittance_lines_dre_idx
  on insurance_remittance_lines (clinic_id, competence_month) where consolidated;

alter table insurance_remittance_batches enable row level security;
alter table insurance_remittance_lines enable row level security;

-- Mesma régua de accounts_payable: gestor administra, faturamento lê
-- (é quem confere a nota contra a guia emitida).
create policy insurance_remittance_batches_read on insurance_remittance_batches
  for select using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'faturamento'));

create policy insurance_remittance_batches_write on insurance_remittance_batches
  for insert with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy insurance_remittance_batches_delete on insurance_remittance_batches
  for delete using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy insurance_remittance_lines_read on insurance_remittance_lines
  for select using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'faturamento'));

create policy insurance_remittance_lines_write on insurance_remittance_lines
  for insert with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy insurance_remittance_lines_update on insurance_remittance_lines
  for update using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy insurance_remittance_lines_delete on insurance_remittance_lines
  for delete using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');
