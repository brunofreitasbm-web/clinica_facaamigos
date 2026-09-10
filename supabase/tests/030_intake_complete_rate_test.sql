-- supabase/tests/030_intake_complete_rate_test.sql
-- §10.1 do PRD: `intake_complete_rate` é a meta operacional da recepção que
-- substituiu `no_show_rate` (20260910071000_intake_complete_rate_metric.sql).
-- Cobre as 3 regras que não são óbvias na fórmula:
--   1. documento anexado DEPOIS da 1ª sessão não conta (o prazo é o ponto);
--   2. carteirinha só é exigida de paciente com convênio;
--   3. faltando um documento obrigatório, o paciente inteiro é incompleto.
begin;
select plan(4);

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000030', 'Clínica Checklist') on conflict do nothing;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000030', 'recepcao.checklist@test.local') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000030', 'recepcao', 'Recepção Checklist')
on conflict do nothing;

insert into insurers (id, clinic_id, name) values
  ('f0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000030', 'Convênio Checklist');

-- 1ª sessão de todo mundo no mês fechado (o que o job apura).
-- p1 convênio completo · p2 convênio sem carteirinha · p3 particular completo
-- sem carteirinha · p4 convênio completo mas com o contrato anexado depois.
insert into patients (id, clinic_id, full_name, birth_date, status, first_session_at) values
  ('d0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000030', 'P1 Convênio OK', '2018-01-01', 'ativo',
   date_trunc('month', now() - interval '1 month') + interval '10 days'),
  ('d0000000-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000030', 'P2 Sem Carteirinha', '2018-01-01', 'ativo',
   date_trunc('month', now() - interval '1 month') + interval '10 days'),
  ('d0000000-0000-0000-0000-000000000033', 'c0000000-0000-0000-0000-000000000030', 'P3 Particular OK', '2018-01-01', 'ativo',
   date_trunc('month', now() - interval '1 month') + interval '10 days'),
  ('d0000000-0000-0000-0000-000000000034', 'c0000000-0000-0000-0000-000000000030', 'P4 Contrato Atrasado', '2018-01-01', 'ativo',
   date_trunc('month', now() - interval '1 month') + interval '10 days');

insert into patient_insurance (patient_id, insurer_id, is_private) values
  ('d0000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000030', false),
  ('d0000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000030', false),
  ('d0000000-0000-0000-0000-000000000034', 'f0000000-0000-0000-0000-000000000030', false);
-- P3 é particular: nenhuma linha de convênio, então carteirinha não é cobrada.
insert into patient_insurance (patient_id, is_private) values
  ('d0000000-0000-0000-0000-000000000033', true);

-- Anexos no prazo (1 dia antes da 1ª sessão).
insert into documents (patient_id, category, storage_path, uploaded_by, uploaded_at)
select p.id, c.category, 'test/' || p.id || '/' || c.category, 'a0000000-0000-0000-0000-000000000030',
       date_trunc('month', now() - interval '1 month') + interval '9 days'
from (values
  ('d0000000-0000-0000-0000-000000000031'::uuid),
  ('d0000000-0000-0000-0000-000000000032'::uuid),
  ('d0000000-0000-0000-0000-000000000033'::uuid),
  ('d0000000-0000-0000-0000-000000000034'::uuid)
) as p(id)
cross join (values
  ('pedido_medico'), ('documento_responsavel'), ('termo_lgpd'), ('termo_imagem')
) as c(category);

-- Contrato: no prazo pra P1/P2/P3, atrasado pra P4 (dia seguinte à 1ª sessão).
insert into documents (patient_id, category, storage_path, uploaded_by, uploaded_at) values
  ('d0000000-0000-0000-0000-000000000031', 'contrato', 'test/p1/contrato', 'a0000000-0000-0000-0000-000000000030',
   date_trunc('month', now() - interval '1 month') + interval '9 days'),
  ('d0000000-0000-0000-0000-000000000032', 'contrato', 'test/p2/contrato', 'a0000000-0000-0000-0000-000000000030',
   date_trunc('month', now() - interval '1 month') + interval '9 days'),
  ('d0000000-0000-0000-0000-000000000033', 'contrato', 'test/p3/contrato', 'a0000000-0000-0000-0000-000000000030',
   date_trunc('month', now() - interval '1 month') + interval '9 days'),
  ('d0000000-0000-0000-0000-000000000034', 'contrato', 'test/p4/contrato', 'a0000000-0000-0000-0000-000000000030',
   date_trunc('month', now() - interval '1 month') + interval '11 days');

-- Carteirinha só pra P1 e P4 (P2 é o caso de convênio sem carteirinha).
insert into documents (patient_id, category, storage_path, uploaded_by, uploaded_at) values
  ('d0000000-0000-0000-0000-000000000031', 'carteirinha', 'test/p1/carteirinha', 'a0000000-0000-0000-0000-000000000030',
   date_trunc('month', now() - interval '1 month') + interval '9 days'),
  ('d0000000-0000-0000-0000-000000000034', 'carteirinha', 'test/p4/carteirinha', 'a0000000-0000-0000-0000-000000000030',
   date_trunc('month', now() - interval '1 month') + interval '9 days');

select close_monthly_metric_snapshots();

select is(
  (select round(value, 2) from metric_snapshots
   where metric_key = 'intake_complete_rate' and scope_id = 'c0000000-0000-0000-0000-000000000030'),
  0.50,
  'intake_complete_rate = 2 completos (P1 convênio, P3 particular) / 4 com 1ª sessão no mês'
);

select is(
  (select period_start from metric_snapshots
   where metric_key = 'intake_complete_rate' and scope_id = 'c0000000-0000-0000-0000-000000000030'),
  date_trunc('month', now() - interval '1 month')::date,
  'snapshot fecha o mês anterior, não o corrente'
);

-- Idempotência: rodar de novo não duplica linha (upsert_metric_snapshot).
select close_monthly_metric_snapshots();
select is(
  (select count(*)::int from metric_snapshots
   where metric_key = 'intake_complete_rate' and scope_id = 'c0000000-0000-0000-0000-000000000030'),
  1,
  'segunda execução do job atualiza a mesma linha em vez de duplicar'
);

-- Clínica sem ninguém estreando no mês não vira 0% (isso puniria a recepção
-- por um mês sem entrada): upsert_metric_snapshot recebe null e não grava.
insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000031', 'Clínica Sem Entrada') on conflict do nothing;
select close_monthly_metric_snapshots();
select is(
  (select count(*)::int from metric_snapshots
   where metric_key = 'intake_complete_rate' and scope_id = 'c0000000-0000-0000-0000-000000000031'),
  0,
  'clínica sem 1ª sessão no mês não ganha snapshot (sem dado ≠ 0%)'
);

select * from finish();
rollback;
