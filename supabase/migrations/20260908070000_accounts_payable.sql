-- Onda 2, módulo Financeiro completo: contas a pagar da clínica (aluguel,
-- folha, fornecedores, impostos etc.) — hoje /gestor/financeiro só cobre
-- repasses (payouts) e glosas; não existe nenhum registro de despesa
-- operacional. `v_contribution_margin` (já existente, nunca usada em tela
-- nenhuma) dá receita - repasse; este módulo fecha o outro lado (despesas)
-- para permitir DRE e fluxo de caixa projetado.

create table accounts_payable (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  category text not null check (category in ('aluguel', 'folha', 'fornecedores', 'impostos', 'marketing', 'manutencao', 'outros')),
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado', 'cancelado')),
  paid_at timestamptz,
  recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_payable_clinic_due_idx on accounts_payable (clinic_id, due_date);

alter table accounts_payable enable row level security;

-- Só gestor mexe (mesma régua de patient_contracts/inventory_items);
-- faturamento só lê, pois hoje seu escopo de RLS é convênio/glosa, não despesa fixa.
create policy accounts_payable_read on accounts_payable
  for select using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'faturamento'));

create policy accounts_payable_write on accounts_payable
  for insert with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy accounts_payable_update on accounts_payable
  for update using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

create policy accounts_payable_delete on accounts_payable
  for delete using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');
