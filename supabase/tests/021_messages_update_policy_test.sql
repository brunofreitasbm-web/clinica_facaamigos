-- Cobre a policy `messages_update_staff` (20260904000021): a caixa de
-- entrada do painel de supervisão (app/supervisao/inbox-actions.ts) precisa
-- marcar um chamado da família como lido/resolvido via UPDATE, algo que
-- `messages` não permitia antes (só tinha SELECT e INSERT).
begin;
select plan(3);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000004', 'supervisor.msg@test.local'),
  ('a0000000-0000-0000-0000-000000000005', 'terapeuta.msg@test.local')
on conflict do nothing;

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste'),
  ('c0000000-0000-0000-0000-000000000099', 'Outra Clínica')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'supervisor', 'Supervisora'),
  ('a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta')
on conflict do nothing;

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Paciente Chamado', '2018-01-01', 'ativo');

insert into messages (id, patient_id, channel, direction, body, sent_at) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'portal', 'inbound', 'Preciso remarcar', now());

-- supervisor da mesma clínica marca como resolvido (read_at)
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004"}';
update messages set read_at = now() where id = 'e0000000-0000-0000-0000-000000000001';
select ok(
  (select read_at is not null from messages where id = 'e0000000-0000-0000-0000-000000000001'),
  'supervisor da clínica marca o chamado como resolvido'
);
reset role;

-- reseta pra testar isolamento de papel
update messages set read_at = null where id = 'e0000000-0000-0000-0000-000000000001';

-- terapeuta (fora da lista de papéis autorizados pela policy) não consegue
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005"}';
update messages set read_at = now() where id = 'e0000000-0000-0000-0000-000000000001';
select ok(
  (select read_at is null from messages where id = 'e0000000-0000-0000-0000-000000000001'),
  'terapeuta não consegue marcar o chamado como resolvido'
);
reset role;

-- supervisor de outra clínica não consegue (isolamento cross-clínica)
insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000099', 'supervisor', 'Supervisora Outra Clínica');
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000006', 'supervisor.outra@test.local')
on conflict do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000006"}';
update messages set read_at = now() where id = 'e0000000-0000-0000-0000-000000000001';
select ok(
  (select read_at is null from messages where id = 'e0000000-0000-0000-0000-000000000001'),
  'supervisor de outra clínica não consegue marcar o chamado como resolvido'
);
reset role;

select * from finish();
rollback;
