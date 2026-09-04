-- Item 11 do PRD "11 incrementos": relaxamento do EXCLUDE de appointments
-- pra permitir múltiplas linhas de sessão em grupo no mesmo horário
-- (mesmo terapeuta/sala), mantendo sessões individuais 100% exclusivas e
-- barrando o caso misto grupo×individual via trigger.
begin;
select plan(4);

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000014', 'terapeuta.grupo@test.local') on conflict do nothing;
insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Grupo')
on conflict do nothing;
insert into rooms (id, clinic_id, name) values ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Sala Grupo');
insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'Paciente Grupo 1', '2018-01-01', 'ativo'),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'Paciente Grupo 2', '2018-01-01', 'ativo');

-- 1: individual x individual continua bloqueado (regressão)
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, modality) values
  ('19000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000014',
   'b0000000-0000-0000-0000-000000000003', 'aba', '2026-07-01 10:00', '2026-07-01 11:00', 'agendada', 'individual');
prepare bad_individual_overlap as
  insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, modality)
  values ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000014',
          'b0000000-0000-0000-0000-000000000003', 'aba', '2026-07-01 10:30', '2026-07-01 11:30', 'agendada', 'individual');
select throws_ok('bad_individual_overlap', '23P01', null, 'duas sessões individuais sobrepostas continuam bloqueadas') as result;

-- 2: grupo x grupo agora é permitido (2 linhas, mesmo terapeuta/sala/horário)
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, modality) values
  ('19000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000014',
   'b0000000-0000-0000-0000-000000000003', 'aba', '2026-07-02 10:00', '2026-07-02 11:00', 'agendada', 'grupo');
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, modality) values
  ('19000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000014',
   'b0000000-0000-0000-0000-000000000003', 'aba', '2026-07-02 10:00', '2026-07-02 11:00', 'agendada', 'grupo');
select ok(
  (select count(*) from appointments where starts_at = '2026-07-02 10:00'::timestamptz and modality = 'grupo') = 2,
  'duas linhas de sessão em grupo no mesmo terapeuta/sala/horário são aceitas'
) as result;

-- 3: individual não pode invadir horário já ocupado por sessão em grupo (mesmo terapeuta)
prepare bad_individual_into_group as
  insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, modality)
  values ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000014',
          'b0000000-0000-0000-0000-000000000003', 'aba', '2026-07-02 10:30', '2026-07-02 11:30', 'agendada', 'individual');
select throws_ok('bad_individual_into_group', null, null, 'sessão individual não invade horário ocupado por sessão em grupo (trigger)') as result;

-- 4: grupo não pode invadir horário já ocupado por sessão individual (mesma sala)
prepare bad_group_into_individual as
  insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, modality)
  values ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000014',
          'b0000000-0000-0000-0000-000000000003', 'aba', '2026-07-01 10:15', '2026-07-01 10:45', 'agendada', 'grupo');
select throws_ok('bad_group_into_individual', null, null, 'sessão em grupo não invade horário ocupado por sessão individual (trigger)') as result;

rollback;
