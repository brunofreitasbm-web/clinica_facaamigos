-- supabase/tests/027_metric_snapshots_monthly_close_test.sql
-- §10.6 do PRD: job mensal que fecha metric_snapshots (no_show_rate,
-- occupancy_rate, glosa_rate) no dia 1 pro mês anterior. Cobre o cálculo
-- com um mês de dados controlado e a idempotência de rodar o job 2x.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000027', 'terapeuta.metrics@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Métricas')
on conflict do nothing;

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000001', 'Paciente Métricas', '2018-01-01', 'ativo');

insert into rooms (id, clinic_id, name) values
  ('e0000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000001', 'Sala Métricas');

insert into insurers (id, clinic_id, name) values
  ('f0000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000001', 'Convênio Métricas');

insert into billing_periods (id, insurer_id, competence_month) values
  ('10000000-0000-0000-0000-000000000027', 'f0000000-0000-0000-0000-000000000027',
   date_trunc('month', now() - interval '1 month')::date);

-- 4 sessões no mês fechado: 2 realizada (1h cada), 1 falta_familia (1h),
-- 1 cancelada_familia (1h) -> no_show_rate = 1/4 = 0.25;
-- occupancy_rate = 2h realizadas / 4h do denominador = 0.50.
-- is_provisional=true só pra não precisar de authorization_id vigente
-- neste teste (appointments_authorization_guard), o que é ortogonal ao que
-- close_monthly_metric_snapshots() calcula.
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional) values
  ('20000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000027', 'e0000000-0000-0000-0000-000000000027', 'aba',
   date_trunc('month', now() - interval '1 month') + interval '3 days 9 hours',
   date_trunc('month', now() - interval '1 month') + interval '3 days 10 hours', 'realizada', true),
  ('20000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000027', 'e0000000-0000-0000-0000-000000000027', 'aba',
   date_trunc('month', now() - interval '1 month') + interval '4 days 9 hours',
   date_trunc('month', now() - interval '1 month') + interval '4 days 10 hours', 'realizada', true),
  ('20000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000027', 'e0000000-0000-0000-0000-000000000027', 'aba',
   date_trunc('month', now() - interval '1 month') + interval '5 days 9 hours',
   date_trunc('month', now() - interval '1 month') + interval '5 days 10 hours', 'falta_familia', true),
  ('20000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000027', 'e0000000-0000-0000-0000-000000000027', 'aba',
   date_trunc('month', now() - interval '1 month') + interval '6 days 9 hours',
   date_trunc('month', now() - interval '1 month') + interval '6 days 10 hours', 'cancelada_familia', true);

-- session_notes obrigatória (trigger billing_items_requires_session_note)
-- pra poder faturar as 2 sessões realizada.
insert into session_notes (appointment_id, therapist_id, created_at_device) values
  ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000027', now()),
  ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000027', now());

-- 2 billing_items no valor de 100 cada, 1 pago e 1 glosado -> glosa_rate = 0.50.
insert into billing_items (billing_period_id, appointment_id, procedure_code, amount, status) values
  ('10000000-0000-0000-0000-000000000027', '20000000-0000-0000-0000-000000000001', '90001', 100, 'pago'),
  ('10000000-0000-0000-0000-000000000027', '20000000-0000-0000-0000-000000000002', '90001', 100, 'glosado');

select close_monthly_metric_snapshots();

select ok(
  (select round(value, 2) from metric_snapshots where metric_key = 'no_show_rate' and scope_id = 'c0000000-0000-0000-0000-000000000001') = 0.25,
  'no_show_rate fechado = 1 falta / 4 sessões do mês'
);

select ok(
  (select round(value, 2) from metric_snapshots where metric_key = 'occupancy_rate' and scope_id = 'c0000000-0000-0000-0000-000000000001') = 0.50,
  'occupancy_rate fechado = 2h realizadas / 4h agendadas'
);

select ok(
  (select round(value, 2) from metric_snapshots where metric_key = 'glosa_rate' and scope_id = 'c0000000-0000-0000-0000-000000000001') = 0.50,
  'glosa_rate fechado = 100 glosado / 200 faturado'
);

select ok(
  (select period_start from metric_snapshots where metric_key = 'no_show_rate' and scope_id = 'c0000000-0000-0000-0000-000000000001')
    = date_trunc('month', now() - interval '1 month')::date,
  'period_start é o primeiro dia do mês fechado'
);

-- Idempotência: rodar de novo (reprocesso manual, retry) não duplica linha,
-- só atualiza o valor via ON CONFLICT.
select close_monthly_metric_snapshots();

select is(
  (select count(*)::int from metric_snapshots where metric_key = 'no_show_rate' and scope_id = 'c0000000-0000-0000-0000-000000000001'),
  1,
  'rodar o job 2x não duplica a linha (idempotente via unique index)'
);

select is(
  (select count(*)::int from metric_snapshots where scope_id = 'c0000000-0000-0000-0000-000000000001'),
  3,
  'as 3 métricas de escopo clínica foram gravadas'
);

select * from finish();
rollback;
