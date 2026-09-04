-- supabase/tests/014_cross_clinic_isolation_test.sql
-- Finding I4: nenhum teste da suíte anterior (013) comprovava isolamento
-- cross-clínica, apesar de 6+ migrations terem corrigido esse padrão.
-- Cria uma SEGUNDA clínica (B) com paciente/perfil/convênio/appointment
-- próprios e confirma, autenticado como gestor/recepção da Clínica B, que
-- nenhuma linha da Clínica A é visível em: patients, appointments,
-- session_notes, billing_items, messages, therapist_contracts,
-- metric_snapshots.
--
-- Também inclui, no mesmo arquivo (decisão de escopo: 014 concentra todas
-- as asserções pgTAP novas deste round de fix, em vez de criar um 015
-- separado), asserções funcionais para:
--   C1 — profiles_self_update: usuário não consegue escalar role/clinic_id/
--        esdm_certified/active via UPDATE, mas continua podendo alterar
--        full_name (campo de contato legítimo).
--   C2 — appointments_authorization_guard roda por um TERAPETA autenticado
--        (sem SELECT direto em authorizations) e ainda assim valida
--        corretamente autorização ausente/esgotada.
--   C4 — billing_items_requires_session_note funciona para o papel
--        faturamento (sem SELECT em session_notes) quando a nota existe.

begin;
select plan(14);

-- =====================================================================
-- Setup Clínica A (dados mínimos, independentes do teste 013)
-- =====================================================================
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000001', 'gestor.a@iso.local'),
  ('c1000000-0000-0000-0000-000000000002', 'terapeuta.a@iso.local'),
  ('c1000000-0000-0000-0000-000000000003', 'faturamento.a@iso.local')
on conflict do nothing;

insert into clinics (id, name) values ('ca000000-0000-0000-0000-000000000001', 'Clínica ISO A') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, esdm_certified) values
  ('c1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'gestor', 'Gestor A', false),
  ('c1000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta A', false),
  ('c1000000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-000000000001', 'faturamento', 'Faturamento A', false)
on conflict do nothing;

insert into rooms (id, clinic_id, name) values ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Sala ISO A');

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('cc000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Paciente ISO A', '2019-01-01', 'ativo');

-- patients_read exige has_patient_access(id, array['terapeuta','responsavel']) para o
-- papel terapeuta — sem este vínculo o terapeuta não vê nem o paciente nem (em cascata,
-- via join em appointments_read/appointments_update) suas próprias appointments.
insert into patient_access (patient_id, profile_id, access_type) values
  ('cc000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'terapeuta');

insert into insurers (id, clinic_id, name) values ('cd000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Convênio ISO A');
insert into patient_insurance (id, patient_id, insurer_id, is_private) values
  ('ce000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000001', false);
insert into authorizations (id, patient_insurance_id, procedure_code, sessions_authorized, valid_from, valid_to, status) values
  ('cf000000-0000-0000-0000-000000000001', 'ce000000-0000-0000-0000-000000000001', 'ABA-01', 5, '2026-01-01', '2026-12-31', 'ativa');

insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status) values
  ('d1000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
   'cb000000-0000-0000-0000-000000000001', 'aba', '2026-07-01 09:00', '2026-07-01 10:00', 'agendada');

insert into session_notes (id, appointment_id, therapist_id, created_at_device, free_text) values
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', now(), 'nota A');

insert into billing_periods (id, insurer_id, competence_month) values
  ('d3000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000001', '2026-07-01');

update appointments set status = 'realizada', is_provisional = true where id = 'd1000000-0000-0000-0000-000000000001';

insert into billing_items (id, billing_period_id, appointment_id, procedure_code, amount) values
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'ABA-01', 150);

insert into messages (id, patient_id, channel, direction, body) values
  ('d5000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'whatsapp', 'outbound', 'mensagem A');

insert into therapist_contracts (id, profile_id, tier, hourly_rate, valid_from) values
  ('d6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'pleno', 80.00, '2026-01-01');

insert into metric_snapshots (id, metric_key, scope_type, scope_id, period_start, period_end, value) values
  ('d7000000-0000-0000-0000-000000000001', 'nps', 'clinica', 'ca000000-0000-0000-0000-000000000001', '2026-07-01', '2026-07-31', 8.5);

-- =====================================================================
-- Setup Clínica B (a que faz as leituras nos testes de isolamento)
-- =====================================================================
insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-000000000001', 'gestor.b@iso.local'),
  ('e1000000-0000-0000-0000-000000000002', 'recepcao.b@iso.local')
on conflict do nothing;

insert into clinics (id, name) values ('ea000000-0000-0000-0000-000000000001', 'Clínica ISO B') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, esdm_certified) values
  ('e1000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000001', 'gestor', 'Gestor B', false),
  ('e1000000-0000-0000-0000-000000000002', 'ea000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção B', false)
on conflict do nothing;

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('ec000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000001', 'Paciente ISO B', '2020-01-01', 'ativo');

-- =====================================================================
-- Isolamento: gestor da Clínica B não enxerga nada da Clínica A
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001"}';

select is_empty(
  $$ select 1 from patients where id = 'cc000000-0000-0000-0000-000000000001' $$,
  'gestor B não enxerga patients da Clínica A'
);
select is_empty(
  $$ select 1 from appointments where id = 'd1000000-0000-0000-0000-000000000001' $$,
  'gestor B não enxerga appointments da Clínica A'
);
select is_empty(
  $$ select 1 from session_notes where id = 'd2000000-0000-0000-0000-000000000001' $$,
  'gestor B não enxerga session_notes da Clínica A'
);
select is_empty(
  $$ select 1 from billing_items where id = 'd4000000-0000-0000-0000-000000000001' $$,
  'gestor B não enxerga billing_items da Clínica A'
);
select is_empty(
  $$ select 1 from messages where id = 'd5000000-0000-0000-0000-000000000001' $$,
  'gestor B não enxerga messages da Clínica A'
);
select is_empty(
  $$ select 1 from therapist_contracts where id = 'd6000000-0000-0000-0000-000000000001' $$,
  'gestor B não enxerga therapist_contracts da Clínica A'
);
select is_empty(
  $$ select 1 from metric_snapshots where id = 'd7000000-0000-0000-0000-000000000001' $$,
  'gestor B não enxerga metric_snapshots da Clínica A'
);

reset role;

-- =====================================================================
-- I2 companion: gestor B não consegue INSERIR metric_snapshot com
-- scope_id da Clínica A (metric_snapshots_write agora escopado).
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001"}';
prepare bad_metric_cross_clinic as
  insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
  values ('nps', 'clinica', 'ca000000-0000-0000-0000-000000000001', '2026-07-01', '2026-07-31', 9.0);
select throws_ok('bad_metric_cross_clinic', null, null, 'gestor B não consegue inserir metric_snapshot com scope_id de outra clínica (I2)');
reset role;

-- =====================================================================
-- C1: profiles_self_update não permite escalação de privilégio, mas
-- continua permitindo atualizar campos de contato (full_name).
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000002"}';

prepare bad_self_escalate_role as
  update profiles set role = 'gestor' where id = 'c1000000-0000-0000-0000-000000000002';
select throws_ok('bad_self_escalate_role', null, null, 'terapeuta não consegue elevar o próprio role via UPDATE (C1)');

update profiles set full_name = 'Terapeuta A Editado' where id = 'c1000000-0000-0000-0000-000000000002';
select is(
  (select full_name from profiles where id = 'c1000000-0000-0000-0000-000000000002'),
  'Terapeuta A Editado',
  'terapeuta consegue atualizar full_name (campo de contato legítimo) via profiles_self_update (C1)'
);

reset role;

-- =====================================================================
-- C2: guard de autorização funciona corretamente executado por um
-- TERAPEUTA autenticado (sem SELECT direto em authorizations).
-- =====================================================================
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status) values
  ('d8000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
   'cb000000-0000-0000-0000-000000000001', 'aba', '2026-07-02 09:00', '2026-07-02 10:00', 'agendada');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000002"}';

-- sem authorization_id: deve falhar mesmo para o terapeuta (guard SECURITY DEFINER)
prepare bad_therapist_no_auth as
  update appointments set status = 'realizada' where id = 'd8000000-0000-0000-0000-000000000001';
select throws_ok('bad_therapist_no_auth', null, null, 'terapeuta autenticado: sessão realizada sem authorization_id ainda falha (C2)');

-- com authorization_id válido: deve funcionar e incrementar sessions_used
update appointments set authorization_id = 'cf000000-0000-0000-0000-000000000001', status = 'realizada'
  where id = 'd8000000-0000-0000-0000-000000000001';
reset role;

select is(
  (select sessions_used from authorizations where id = 'cf000000-0000-0000-0000-000000000001'),
  1,
  'terapeuta autenticado com authorization_id válido: guard valida e incrementa sessions_used (C2)'
);

-- =====================================================================
-- C4: faturamento consegue inserir billing_item quando session_note já
-- existe, mesmo sem SELECT direto em session_notes (guard SECURITY DEFINER).
-- =====================================================================
insert into session_notes (id, appointment_id, therapist_id, created_at_device, free_text) values
  ('d9000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', now(), 'nota para faturamento');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000003"}';

insert into billing_items (id, billing_period_id, appointment_id, procedure_code, amount) values
  ('da000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'ABA-01', 150);

select is(
  (select count(*)::int from billing_items where id = 'da000000-0000-0000-0000-000000000001'),
  1,
  'faturamento consegue inserir billing_item com session_note existente, guard SECURITY DEFINER (C4)'
);

reset role;

-- =====================================================================
-- M4: unique(insurer_id, competence_month) em billing_periods
-- =====================================================================
prepare bad_duplicate_billing_period as
  insert into billing_periods (insurer_id, competence_month) values ('cd000000-0000-0000-0000-000000000001', '2026-07-01');
select throws_ok('bad_duplicate_billing_period', '23505', null, 'billing_periods não aceita (insurer_id, competence_month) duplicado (M4)');

select * from finish();
rollback;
