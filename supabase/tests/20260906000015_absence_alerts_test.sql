-- Gestão de faltas (MAAIS §13 / "risco de evasão", PRD linha 390).
-- Cobre patient_absence_stats(), refresh_absence_alerts() (cálculo +
-- dedup + notificação) e a RLS de absence_alerts (gestor/supervisor/
-- recepção da clínica, terapeuta e responsável vinculados ao paciente).
begin;
select plan(7);

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000002', 'terapeuta.faltas@test.local'),
  ('b0000000-0000-0000-0000-000000000003', 'responsavel.faltas@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000002', 'Clínica Teste Faltas') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'terapeuta', 'Terapeuta Faltas'),
  ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'responsavel', 'Responsável Faltas');

insert into rooms (id, clinic_id, name) values
  ('b0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000002', 'Sala Teste 1'),
  ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000002', 'Sala Teste 2');

-- Paciente com 3 faltas consecutivas — deve cruzar o limiar.
insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Paciente Faltoso', '2018-01-01', 'ativo');

-- Paciente com frequência normal — não deve gerar alerta.
insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Paciente Assíduo', '2018-01-01', 'ativo');

insert into guardians (id, patient_id, full_name, phone, is_financial) values
  ('e0000000-0000-0000-0000-0000000000aa', 'e0000000-0000-0000-0000-000000000001', 'Mãe Faltoso', '+5591999990000', true);

insert into patient_access (patient_id, profile_id, access_type) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'terapeuta'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'responsavel');

insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'aba', now() - interval '3 days', now() - interval '3 days' + interval '40 minutes', 'falta_familia', true),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'aba', now() - interval '2 days', now() - interval '2 days' + interval '40 minutes', 'falta_familia', true),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'aba', now() - interval '1 days', now() - interval '1 days' + interval '40 minutes', 'falta_familia', true),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'aba', now() - interval '3 days' + interval '1 hour', now() - interval '3 days' + interval '1 hour 40 minutes', 'realizada', true),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'aba', now() - interval '2 days' + interval '1 hour', now() - interval '2 days' + interval '1 hour 40 minutes', 'realizada', true);

select is(
  (select consecutive_faltas from patient_absence_stats('e0000000-0000-0000-0000-000000000001')),
  3,
  'patient_absence_stats detecta 3 faltas consecutivas'
);

select refresh_absence_alerts();

select ok(
  exists (select 1 from absence_alerts where patient_id = 'e0000000-0000-0000-0000-000000000001' and status = 'pendente'),
  'paciente com 3 faltas consecutivas recebe alerta pendente'
);

select ok(
  not exists (select 1 from absence_alerts where patient_id = 'e0000000-0000-0000-0000-000000000002'),
  'paciente assíduo não gera alerta'
);

select ok(
  exists (
    select 1 from messages
    where patient_id = 'e0000000-0000-0000-0000-000000000001'
      and channel = 'portal'
      and template_key = 'aviso_faltas'
  ),
  'aviso gravado no canal portal'
);

select is(
  (select refresh_absence_alerts()),
  0,
  'segunda execução não duplica alerta dentro da janela de dedup'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000002"}';
select ok(
  exists (select 1 from absence_alerts where patient_id = 'e0000000-0000-0000-0000-000000000001'),
  'terapeuta com patient_access enxerga o alerta do paciente vinculado'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000003"}';
select ok(
  exists (select 1 from absence_alerts where patient_id = 'e0000000-0000-0000-0000-000000000001'),
  'responsável vinculado enxerga o próprio alerta no portal da família'
);
reset role;

select * from finish();
rollback;
