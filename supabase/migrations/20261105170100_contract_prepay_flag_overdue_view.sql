-- Cobrança antes do ciclo + atraso: base DORMENTE e somente informativa.
--
-- 1) patient_contracts.require_prepay (default false): marca contratos para os quais a clínica
--    exige pagamento ANTES do ciclo. Nada no código ou no banco lê esta coluna para bloquear
--    agenda; é só dado para a recepção/gestão (e futura automação, ver
--    docs/superpowers/specs/2026-11-05-pacote-6-sessoes-standby-design.md).
-- 2) v_contract_overdue_invoices: lista contratos ativos com fatura vencida e não paga
--    (status pendente/atrasado e due_date < hoje, fuso America/Sao_Paulo). security_invoker:
--    respeita o RLS de patient_contracts/contract_invoices (escopo da clínica). Somente leitura.
--
-- Reversão: drop view public.v_contract_overdue_invoices;
--           alter table public.patient_contracts drop column require_prepay;

alter table public.patient_contracts
  add column if not exists require_prepay boolean not null default false;

create or replace view public.v_contract_overdue_invoices
with (security_invoker = true) as
select
  c.id            as contract_id,
  c.clinic_id,
  c.patient_id,
  c.status        as contract_status,
  c.billing_mode,
  c.sessions_per_month,
  c.require_prepay,
  i.id            as invoice_id,
  i.reference_month,
  i.due_date,
  i.amount,
  i.status        as invoice_status,
  ((now() at time zone 'America/Sao_Paulo')::date - i.due_date) as days_overdue
from public.patient_contracts c
join public.contract_invoices i on i.contract_id = c.id
where c.status = 'ativo'
  and i.status in ('pendente', 'atrasado')
  and i.due_date < (now() at time zone 'America/Sao_Paulo')::date;

comment on view public.v_contract_overdue_invoices is
  'Contratos ativos com fatura vencida e não paga (leitura para a recepção). Não bloqueia agenda.';
