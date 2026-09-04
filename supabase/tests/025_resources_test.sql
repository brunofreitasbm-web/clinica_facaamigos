-- Item 10 do PRD "11 incrementos": estoque e reserva de recursos.
-- Cobre o bloqueio de concorrência (EXCLUDE) e a RLS de cadastro
-- (só gestor/supervisor) vs. reserva (qualquer papel operacional).
begin;
select plan(4);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000015', 'terapeuta.recurso@test.local'),
  ('a0000000-0000-0000-0000-000000000016', 'recepcao.recurso@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Recurso'),
  ('a0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção Recurso')
on conflict do nothing;

-- terapeuta não consegue cadastrar recurso (só gestor/supervisor)
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000015"}';
prepare bad_resource_insert as
  insert into resources (clinic_id, name, category) values
    ('c0000000-0000-0000-0000-000000000001', 'Prancha X', 'prancha_comunicacao');
create temp table t1 as select throws_ok('bad_resource_insert', null, null, 'terapeuta não consegue cadastrar recurso') as v;
reset role;

insert into resources (id, clinic_id, name, category) values
  ('1b000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Prancha de comunicação A', 'prancha_comunicacao');

-- terapeuta consegue reservar (papel operacional)
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000015"}';
insert into resource_bookings (id, resource_id, booked_by, starts_at, ends_at) values
  ('1c000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000015',
   '2026-08-01 09:00', '2026-08-01 09:30');
reset role;

create temp table t2 as select exists (select 1 from resource_bookings where id = '1c000000-0000-0000-0000-000000000001') as v;

-- segunda reserva do mesmo recurso sobrepondo o horário é rejeitada
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000016"}';
prepare bad_overlap_booking as
  insert into resource_bookings (resource_id, booked_by, starts_at, ends_at) values
    ('1b000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000016', '2026-08-01 09:15', '2026-08-01 09:45');
create temp table t3 as select throws_ok('bad_overlap_booking', '23P01', null, 'reserva sobreposta do mesmo recurso é rejeitada') as v;
reset role;

-- recepção (não é quem reservou) consegue cancelar em nome da clínica
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000016"}';
update resource_bookings set status = 'cancelado' where id = '1c000000-0000-0000-0000-000000000001';
reset role;

create temp table t4 as select (status = 'cancelado') as v from resource_bookings where id = '1c000000-0000-0000-0000-000000000001';

select v as result from t1
union all select ok((select v from t2), 'terapeuta consegue reservar um recurso')
union all select v from t3
union all select ok((select v from t4), 'recepção consegue cancelar reserva de outra pessoa');

rollback;
