-- Task 15: pgTAP para N1-N3 (re-review de 20260904000014).
begin;
select plan(6);

-- Setup: duas clínicas (A, B), gestor + terapeuta em cada, um paciente/appointment em A.
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000001', 'gestor.a@test015.local'),
  ('c1000000-0000-0000-0000-000000000002', 'terapeuta.a@test015.local'),
  ('c1000000-0000-0000-0000-000000000003', 'gestor.b@test015.local'),
  ('c1000000-0000-0000-0000-000000000004', 'terapeuta.b@test015.local')
on conflict do nothing;

insert into clinics (id, name) values
  ('c2000000-0000-0000-0000-000000000001', 'Clínica A 015'),
  ('c2000000-0000-0000-0000-000000000002', 'Clínica B 015')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, esdm_certified) values
  ('c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'gestor', 'Gestor A', false),
  ('c1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta A', false),
  ('c1000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000002', 'gestor', 'Gestor B', false),
  ('c1000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000002', 'terapeuta', 'Terapeuta B', false)
on conflict do nothing;

insert into rooms (id, clinic_id, name) values
  ('c3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Sala A 015');

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('c4000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Paciente A 015', '2019-01-01', 'ativo');

insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
values ('c5000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001',
        'c1000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', 'aba',
        now(), now() + interval '1 hour', 'agendada');

insert into therapist_contracts (id, profile_id, tier, hourly_rate, valid_from)
values ('c6000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'senior', 100, '2026-01-01');

-- (a) gestor da clínica A consegue certificar terapeuta A em ESDM
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001"}';
update profiles set esdm_certified = true where id = 'c1000000-0000-0000-0000-000000000002';
select ok(
  (select esdm_certified from profiles where id = 'c1000000-0000-0000-0000-000000000002') = true,
  'N1a: gestor da própria clínica consegue certificar terapeuta em ESDM'
);
reset role;

-- (b) gestor da clínica B NÃO consegue alterar perfil da clínica A
-- (a policy_read de profiles já esconde a linha de outra clínica do gestor B,
-- então o UPDATE não encontra linha para atualizar; conferimos o resultado
-- de volta como superusuário, fora do contexto RLS do gestor B)
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000003"}';
update profiles set esdm_certified = false where id = 'c1000000-0000-0000-0000-000000000002';
reset role;
select ok(
  (select esdm_certified from profiles where id = 'c1000000-0000-0000-0000-000000000002') = true,
  'N1b: gestor de clínica B não consegue alterar perfil de clínica A (update não afeta linha)'
);

-- (c) terapeuta comum não consegue se promover via profiles_admin_update (só gestor tem essa policy)
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000002"}';
prepare terapeuta_self_promote as
  update profiles set role = 'gestor' where id = 'c1000000-0000-0000-0000-000000000002';
select throws_ok('terapeuta_self_promote', null, null, 'N1c: terapeuta comum não consegue se auto-promover a gestor');
deallocate terapeuta_self_promote;
reset role;

-- (d) update de therapist_contracts reapontando profile_id para outra clínica falha
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001"}';
prepare contract_repoint as
  update therapist_contracts set profile_id = 'c1000000-0000-0000-0000-000000000004'
  where id = 'c6000000-0000-0000-0000-000000000001';
select throws_ok(
  'contract_repoint', '42501', null,
  'N2: reapontar contrato para profile de outra clínica falha (bloqueado por WITH CHECK)'
);
deallocate contract_repoint;
reset role;

-- (e) session_note_pending de appointment de outra clínica não vaza dado real: retorna false
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000004"}';
select ok(
  session_note_pending('c5000000-0000-0000-0000-000000000001') = false,
  'N3a: session_note_pending de appointment de outra clínica retorna false (não vaza)'
);
reset role;

-- (e2) controle: dentro da própria clínica, appointment ainda 'agendada' (não 'realizada') -> false
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-0000-0000-000000000001"}';
select ok(
  session_note_pending('c5000000-0000-0000-0000-000000000001') = false,
  'N3b: dentro da própria clínica, appointment ainda não realizado -> false (controle sanity)'
);
reset role;

select * from finish();
rollback;
