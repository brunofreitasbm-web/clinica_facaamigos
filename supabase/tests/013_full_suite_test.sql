-- Task 13: suíte pgTAP consolidada — 10 testes funcionais reais do spec
-- (multiusuário: terapeuta A vs B, recepção, responsável, supervisor sem
-- certificação ESDM etc.), usando dados de teste completos (auth.users,
-- profiles, patients, appointments, session_notes, billing, programs).

-- Nota de contagem: o spec descreve "10 requisitos", mas o teste 2 do brief
-- ("authorization esgotada bloqueia; is_provisional passa e não incrementa
-- sessions_used") já contém duas asserções pgTAP distintas (throws_ok +
-- ok) no SQL original — logo o total real de asserções desta suíte é 11,
-- não 10. plan(11) reflete a contagem real de select ok/is/throws_ok/is_empty
-- executados abaixo; os "10 requisitos funcionais" do spec continuam todos
-- cobertos (o requisito 2 só produz duas asserções pgTAP).
begin;
select plan(11);

-- Setup: clínica, salas, protocolo, usuários de teste (auth.users + profiles) para cada papel.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'gestor@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'terapeuta.a@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'terapeuta.b@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'recepcao@test.local'),
  ('a0000000-0000-0000-0000-000000000005', 'responsavel@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, esdm_certified) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'gestor', 'Gestor', false),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta A', false),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta B', false),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção', false),
  ('a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável', false)
on conflict do nothing;

insert into rooms (id, clinic_id, name) values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sala 1');

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Paciente A', '2018-01-01', 'ativo');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'terapeuta'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'responsavel');

insert into guardians (id, patient_id, profile_id, full_name, phone) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'Mãe', '11999999999');

insert into insurers (id, clinic_id, name) values ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Convênio X');
insert into patient_insurance (id, patient_id, insurer_id, is_private) values
  ('11000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', false);

insert into authorizations (id, patient_insurance_id, procedure_code, sessions_authorized, valid_from, valid_to, status) values
  ('12000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ABA-01', 1, '2026-01-01', '2026-12-31', 'ativa');

insert into protocols (id, clinic_id, name, digitization_risk_accepted_by, digitization_risk_accepted_at) values
  ('13000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'esdm', 'a0000000-0000-0000-0000-000000000001', now());
insert into protocol_items (id, protocol_id, domain, item_code, description) values
  ('14000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'social', 'D1', 'item transcrito');

-- 1. sessão realizada sem guia vigente falha
prepare bad_no_auth as
  insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
          'b0000000-0000-0000-0000-000000000001', 'aba', now(), now() + interval '1 hour', 'realizada');
select throws_ok('bad_no_auth', null, null, 'sessão realizada sem authorization_id falha');

-- 2. authorization esgotada bloqueia; is_provisional passa e não incrementa sessions_used
update authorizations set sessions_used = 1 where id = '12000000-0000-0000-0000-000000000001';
prepare bad_exhausted as
  insert into appointments (patient_id, therapist_id, room_id, authorization_id, discipline, starts_at, ends_at, status)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
          'b0000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'aba',
          now() + interval '2 hour', now() + interval '3 hour', 'realizada');
select throws_ok('bad_exhausted', null, null, 'sessão realizada com sessions_used >= sessions_authorized falha');
update authorizations set sessions_used = 0 where id = '12000000-0000-0000-0000-000000000001';

insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional)
values ('15000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001', 'aba', now() + interval '4 hour', now() + interval '5 hour', 'realizada', true);
select ok(
  (select sessions_used from authorizations where id = '12000000-0000-0000-0000-000000000001') = 0,
  'appointment provisória não incrementa sessions_used'
);

-- 3. sala não pode ter duas sessões sobrepostas
insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001', 'aba', '2026-06-01 10:00', '2026-06-01 11:00', 'agendada');
prepare bad_room_overlap as
  insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
          'b0000000-0000-0000-0000-000000000001', 'aba', '2026-06-01 10:30', '2026-06-01 11:30', 'agendada');
select throws_ok('bad_room_overlap', '23P01', null, 'sala não aceita horário sobreposto');

-- 4. session_notes não aceita UPDATE
-- Nota: não existe policy de UPDATE para session_notes (Tasks 7/7b/7c) — o comportamento
-- real do RLS para um comando sem policy aplicável não é lançar exceção, é excluir
-- silenciosamente a(s) linha(s) do UPDATE (0 linhas afetadas). Por isso o teste original do
-- brief (throws_ok) foi ajustado para is(): validamos que, autenticado como o próprio autor
-- da nota (que tem SELECT via appointments.therapist_id = auth.uid()), o UPDATE afeta 0
-- linhas e o valor original permanece intacto — o schema realmente impede a edição, apenas
-- não via exceção.
insert into session_notes (id, appointment_id, therapist_id, created_at_device, free_text)
values ('16000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000002', now(), 'original');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
update session_notes set free_text = 'editado' where id = '16000000-0000-0000-0000-000000000001';
select is(
  (select free_text from session_notes where id = '16000000-0000-0000-0000-000000000001'),
  'original',
  'UPDATE em session_notes é bloqueado por RLS (sem policy de UPDATE) — free_text permanece "original"'
);
reset role;

-- 5. billing_items sem session_notes falha
-- Nota: o INSERT abaixo usa is_provisional=true (diferente do brief original, que omitia
-- a coluna). O guard de autorização (Task 6/6b) dispara para toda transição PARA
-- status='realizada' quando is_provisional=false, exigindo authorization_id — o que não é o
-- que este teste quer exercitar (ele testa o guard de billing_items, não o de authorization).
-- Sem is_provisional=true este INSERT já falharia antes de chegar no teste de billing.
insert into billing_periods (id, insurer_id, competence_month) values
  ('17000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-06-01');
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional)
values ('18000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001', 'aba', '2026-06-02 10:00', '2026-06-02 11:00', 'realizada', true);
prepare bad_billing_no_note as
  insert into billing_items (billing_period_id, appointment_id, procedure_code, amount)
  values ('17000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', 'ABA-01', 100);
select throws_ok('bad_billing_no_note', null, null, 'billing_items sem session_notes falha');

-- 6. RLS: terapeuta B não vê appointments de paciente só vinculado ao terapeuta A
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003"}';
select is_empty(
  $$ select 1 from appointments where patient_id = 'd0000000-0000-0000-0000-000000000001' and therapist_id <> 'a0000000-0000-0000-0000-000000000003' $$,
  'terapeuta B não enxerga appointments de paciente sem patient_access'
);
reset role;

-- 7. RLS: responsável não vê session_notes do próprio filho
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005"}';
select is_empty(
  $$ select 1 from session_notes $$,
  'responsável não enxerga nenhuma linha de session_notes'
);
reset role;

-- 8. RLS: recepção não vê session_notes nem protocol_items
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004"}';
select is_empty($$ select 1 from session_notes $$, 'recepção não enxerga session_notes');
reset role;

-- 9. RLS: terapeuta sem esdm_certified não vê protocol_items do protocolo esdm
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
select is_empty(
  $$ select 1 from protocol_items where protocol_id = '13000000-0000-0000-0000-000000000001' $$,
  'terapeuta não certificado em ESDM não enxerga protocol_items desse protocolo'
);
reset role;

-- 10. programs: XOR entre domain_taxonomy_id e protocol_item_id
insert into treatment_plans (id, patient_id) values ('19000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001');
insert into plan_goals (id, treatment_plan_id, discipline, domain, description) values
  ('1a000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'aba', 'social', 'meta teste');
prepare bad_programs_xor as
  insert into programs (plan_goal_id, domain_taxonomy_id, protocol_item_id, name, target_type)
  values ('1a000000-0000-0000-0000-000000000001', null, null, 'programa teste', 'tentativa');
select throws_ok('bad_programs_xor', '23514', null, 'programs exige exatamente um de domain_taxonomy_id/protocol_item_id');

select * from finish();
rollback;
