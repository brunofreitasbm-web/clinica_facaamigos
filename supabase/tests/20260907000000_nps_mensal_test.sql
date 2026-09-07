-- Disparo mensal de NPS (0-10), reaproveitando nps_surveys
-- (20260907000000_nps_mensal.sql). Cobre: constraint de alvo (mensal sem
-- appointment_id/meeting_id, period obrigatório; evento com exatamente um
-- dos dois, period nulo), faixa de nota ampliada (0-10) e dedup por
-- (patient_id, period).
begin;
select plan(6);

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000004', 'terapeuta.npsmensal@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000003', 'Clínica Teste NPS Mensal') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'terapeuta', 'Terapeuta NPS Mensal');

insert into rooms (id, clinic_id, name) values
  ('b0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000003', 'Sala Teste NPS Mensal');

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Paciente NPS Mensal', '2018-01-01', 'ativo');

insert into guardians (id, patient_id, full_name, phone, is_financial) values
  ('e0000000-0000-0000-0000-0000000000bb', 'e0000000-0000-0000-0000-000000000003', 'Mãe NPS Mensal', '+5591999990001', true);

insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional) values
  ('e0000000-0000-0000-0000-0000000000cc', 'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-00000000000c', 'aba', now() - interval '1 hour', now() - interval '20 minutes', 'realizada', true);

-- Disparo mensal válido: sem appointment/meeting, com period.
select lives_ok(
  $$ insert into nps_surveys (patient_id, guardian_id, phone_number, trigger_type, period)
     values ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000bb', '+5591999990001', 'mensal', '2026-09') $$,
  'disparo mensal aceita nps_surveys sem appointment_id/meeting_id, com period'
);

-- Nota 0-10 aceita no disparo mensal (fora da faixa antiga 1-5).
select lives_ok(
  $$ update nps_surveys set score = 0, responded_at = now()
     where patient_id = 'e0000000-0000-0000-0000-000000000003' and trigger_type = 'mensal' and period = '2026-09' $$,
  'score = 0 é aceito (faixa ampliada para 0-10)'
);

-- Dedup: segundo disparo mensal no mesmo período pro mesmo paciente falha.
select throws_ok(
  $$ insert into nps_surveys (patient_id, guardian_id, phone_number, trigger_type, period)
     values ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000bb', '+5591999990001', 'mensal', '2026-09') $$,
  23505,
  null,
  'segundo disparo mensal no mesmo período pro mesmo paciente viola unique (patient_id, period)'
);

-- Disparo mensal com appointment_id preenchido viola a constraint de alvo.
select throws_ok(
  $$ insert into nps_surveys (patient_id, guardian_id, phone_number, trigger_type, period, appointment_id)
     values ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000bb', '+5591999990001', 'mensal', '2026-10', 'e0000000-0000-0000-0000-0000000000cc') $$,
  23514,
  null,
  'disparo mensal com appointment_id preenchido viola nps_surveys_target_check'
);

-- Disparo por evento sem period nem appointment_id/meeting_id viola a constraint.
select throws_ok(
  $$ insert into nps_surveys (patient_id, guardian_id, phone_number, trigger_type)
     values ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000bb', '+5591999990001', 'evaluation') $$,
  23514,
  null,
  'disparo evaluation sem appointment_id nem meeting_id viola nps_surveys_target_check'
);

-- Nota 6 é detrator na escala mensal (0-10), mas dentro da faixa aceita.
select ok(
  (select score between 0 and 10 from nps_surveys where patient_id = 'e0000000-0000-0000-0000-000000000003' and trigger_type = 'mensal' and period = '2026-09'),
  'score do disparo mensal respeita a faixa 0-10'
);

select * from finish();
rollback;
