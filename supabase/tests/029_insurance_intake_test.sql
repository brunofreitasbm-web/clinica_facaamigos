-- "Acolhimento oriundo de plano de saúde" (20260907170006_insurance_intake.sql).
-- Cobre: leitura restrita a recepção/supervisor/gestor da própria clínica,
-- bloqueio de insert por papel de aplicação em insurance_intake_leads (só
-- admin client cria), insert de lote só por supervisor/gestor, o novo CHECK
-- de status, set_insurer_intake_profile (papel + escopo por clínica) e o
-- fluxo completo de book_intake_lead_slot_atomic (agendamento, conflito,
-- dupla reserva, e privilégio de execução negado a authenticated).
begin;
select plan(18);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000030', 'supervisor.intake@test.local'),
  ('a0000000-0000-0000-0000-000000000031', 'terapeuta.intake@test.local'),
  ('a0000000-0000-0000-0000-000000000032', 'recepcao.intake@test.local'),
  ('a0000000-0000-0000-0000-000000000033', 'supervisor.outraclinica.intake@test.local')
on conflict do nothing;

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste'),
  ('c0000000-0000-0000-0000-000000000099', 'Outra Clínica')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000001', 'supervisor', 'Supervisor Intake'),
  ('a0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Intake'),
  ('a0000000-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção Intake'),
  ('a0000000-0000-0000-0000-000000000033', 'c0000000-0000-0000-0000-000000000099', 'supervisor', 'Supervisor Outra Clínica')
on conflict do nothing;

insert into insurers (id, clinic_id, name) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Convênio Teste Intake'),
  ('e0000000-0000-0000-0000-000000000099', 'c0000000-0000-0000-0000-000000000099', 'Convênio Outra Clínica')
on conflict do nothing;

insert into rooms (id, clinic_id, name) values
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sala Intake')
on conflict do nothing;

insert into insurance_intake_batches (id, clinic_id, insurer_id, storage_path, status, uploaded_by) values
  ('19100000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'intake/batches/x/y.pdf', 'extracted', 'a0000000-0000-0000-0000-000000000030');

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000001', 'Paciente Intake', '2019-05-01', 'interessado');

-- Lead 1: em 'extracted', usado nos testes de leitura/CHECK.
insert into insurance_intake_leads (id, clinic_id, batch_id, insurer_id, row_index, patient_full_name, phone_e164, status) values
  ('19200000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 0, 'Criança Um', '+5511900000001', 'extracted');

-- Lead 2: já em 'awaiting_slot', com paciente vinculado — usado no teste da RPC de agendamento.
insert into insurance_intake_leads (id, clinic_id, batch_id, insurer_id, row_index, patient_full_name, phone_e164, patient_id, status) values
  ('19200000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'Criança Dois', '+5511900000002', 'd0000000-0000-0000-0000-000000000030', 'awaiting_slot');

-- 1/2: supervisor e recepção da própria clínica leem o lote e os 2 leads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
create temp table t_supervisor_batches as select count(*) as v from insurance_intake_batches;
create temp table t_supervisor_leads as select count(*) as v from insurance_intake_leads;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000032"}';
create temp table t_recepcao_leads as select count(*) as v from insurance_intake_leads;
reset role;

-- 3: terapeuta (fora do conjunto de papéis autorizados) não vê nenhum lote.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000031"}';
create temp table t_terapeuta_batches as select count(*) as v from insurance_intake_batches;
reset role;

-- 4: supervisor de outra clínica não vê nenhum lead.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000033"}';
create temp table t_outra_clinica_leads as select count(*) as v from insurance_intake_leads;
reset role;

-- 5: supervisor consegue inserir um novo lote (upload da remessa).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
insert into insurance_intake_batches (id, clinic_id, storage_path, uploaded_by)
values ('19100000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'intake/batches/z/w.pdf', 'a0000000-0000-0000-0000-000000000030');
reset role;
create temp table t_batch_inserted as select count(*) as v from insurance_intake_batches where id = '19100000-0000-0000-0000-000000000002';

-- 6: terapeuta não consegue inserir lote.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000031"}';
prepare bad_batch_insert as
  insert into insurance_intake_batches (clinic_id, storage_path, uploaded_by)
  values ('c0000000-0000-0000-0000-000000000001', 'intake/batches/bad/bad.pdf', 'a0000000-0000-0000-0000-000000000031');
create temp table t_bad_batch_insert as
  select throws_ok('bad_batch_insert', null, null, 'terapeuta não consegue inserir lote de acolhimento') as v;
reset role;

-- 7: nenhum papel de aplicação consegue inserir lead diretamente (só client admin).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
prepare bad_lead_insert as
  insert into insurance_intake_leads (clinic_id, batch_id, row_index, status)
  values ('c0000000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', 99, 'extracted');
create temp table t_bad_lead_insert as
  select throws_ok('bad_lead_insert', null, null, 'supervisor não consegue inserir lead diretamente (só client admin)') as v;
reset role;

-- 8: CHECK de status inválido.
create temp table t_bad_status as
  select throws_ok(
    $$insert into insurance_intake_leads (clinic_id, batch_id, row_index, status) values ('c0000000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', 98, 'nao_existe')$$,
    null, null, 'status fora do CHECK é rejeitado'
  ) as v;

-- 9/10/11: set_insurer_intake_profile — supervisor ok, terapeuta nega, convênio de outra clínica nega.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
select set_insurer_intake_profile('e0000000-0000-0000-0000-000000000001', '{"version":1,"layout_hints":"teste"}'::jsonb);
reset role;
create temp table t_profile_saved as
  select (intake_extraction_profile->>'layout_hints' = 'teste') as v from insurers where id = 'e0000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000031"}';
prepare bad_profile_role as select set_insurer_intake_profile('e0000000-0000-0000-0000-000000000001', '{}'::jsonb);
create temp table t_bad_profile_role as
  select throws_ok('bad_profile_role', null, null, 'terapeuta não pode configurar perfil de extração') as v;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
prepare bad_profile_scope as select set_insurer_intake_profile('e0000000-0000-0000-0000-000000000099', '{}'::jsonb);
create temp table t_bad_profile_scope as
  select throws_ok('bad_profile_scope', null, null, 'supervisor não configura perfil de convênio de outra clínica') as v;
reset role;

-- 12: authenticated não pode executar book_intake_lead_slot_atomic diretamente
-- (revogada — só o client admin, via bot do WhatsApp, chama).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
prepare bad_book_rpc as
  select book_intake_lead_slot_atomic(
    '19200000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000001',
    now() + interval '1 day', now() + interval '1 day 50 minutes'
  );
create temp table t_bad_book_rpc as
  select throws_ok('bad_book_rpc', null, null, 'authenticated não pode chamar book_intake_lead_slot_atomic diretamente') as v;
reset role;

-- 13: lead em status errado ('extracted') não agenda.
create temp table t_book_wrong_status as
  select (book_intake_lead_slot_atomic(
    '19200000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000001',
    now() + interval '1 day', now() + interval '1 day 50 minutes'
  )->>'success')::boolean as v;

-- 14: lead em 'awaiting_slot' agenda com sucesso; paciente vira 'avaliacao'.
create temp table t_book_ok as
  select (book_intake_lead_slot_atomic(
    '19200000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000001',
    now() + interval '2 days', now() + interval '2 days 50 minutes'
  )->>'success')::boolean as v;
create temp table t_lead_scheduled as select (status = 'scheduled' and appointment_id is not null) as v from insurance_intake_leads where id = '19200000-0000-0000-0000-000000000002';
create temp table t_patient_avaliacao as select (status = 'avaliacao') as v from patients where id = 'd0000000-0000-0000-0000-000000000030';

-- 15: segunda tentativa no mesmo lead (já agendado) falha.
create temp table t_book_twice as
  select (book_intake_lead_slot_atomic(
    '19200000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000001',
    now() + interval '3 days', now() + interval '3 days 50 minutes'
  )->>'success')::boolean as v;

select ok((select v from t_supervisor_batches) = 1, 'supervisor da clínica lê o lote')
union all
select ok((select v from t_supervisor_leads) = 2, 'supervisor da clínica lê os 2 leads')
union all
select ok((select v from t_recepcao_leads) = 2, 'recepção da clínica também lê os leads')
union all
select ok((select v from t_terapeuta_batches) = 0, 'terapeuta não vê lotes de acolhimento')
union all
select ok((select v from t_outra_clinica_leads) = 0, 'supervisor de outra clínica não vê leads')
union all
select ok((select v from t_batch_inserted) = 1, 'supervisor consegue inserir um novo lote')
union all
select v from t_bad_batch_insert
union all
select v from t_bad_lead_insert
union all
select v from t_bad_status
union all
select ok((select v from t_profile_saved), 'supervisor salva o perfil de extração do convênio')
union all
select v from t_bad_profile_role
union all
select v from t_bad_profile_scope
union all
select v from t_bad_book_rpc
union all
select ok(not (select v from t_book_wrong_status), 'lead em extracted não agenda pela RPC')
union all
select ok((select v from t_book_ok), 'lead em awaiting_slot agenda com sucesso')
union all
select ok((select v from t_lead_scheduled), 'lead marcado como scheduled com appointment_id')
union all
select ok((select v from t_patient_avaliacao), 'trigger promove o paciente para avaliacao ao criar o appointment')
union all
select ok(not (select v from t_book_twice), 'segunda tentativa no mesmo lead já agendado falha')
;

select * from finish();
rollback;
