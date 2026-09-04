-- Item 4 do PRD "11 incrementos": feed interativo da família. Mural
-- independente das evoluções — só staff (recepção/supervisor/gestor/
-- terapeuta vinculado) posta; responsável só lê.
begin;
select plan(5);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000007', 'terapeuta.feed@test.local'),
  ('a0000000-0000-0000-0000-000000000008', 'responsavel.feed@test.local'),
  ('a0000000-0000-0000-0000-000000000009', 'terapeuta.outro.feed@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Feed'),
  ('a0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável Feed'),
  ('a0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Sem Vínculo')
on conflict do nothing;

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Paciente Feed', '2018-01-01', 'ativo');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'terapeuta'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000008', 'responsavel');

-- terapeuta vinculado consegue postar
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000007"}';
insert into feed_posts (id, patient_id, author_id, body) values
  ('16000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'Recado da terapeuta');
reset role;

create temp table t_post_exists as select exists (select 1 from feed_posts where id = '16000000-0000-0000-0000-000000000001') as v;

-- responsável NÃO consegue postar (mural é read-only pra família) — throws_ok
-- precisa rodar ANTES do reset role (senão executa como o role padrão da
-- conexão, que não tem RLS habilitada, e o teste dá falso-positivo).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000008"}';
prepare bad_family_post as
  insert into feed_posts (patient_id, author_id, body)
  values ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000008', 'tentando postar');
create temp table t_bad_family_post as
  select throws_ok('bad_family_post', null, null, 'responsável não consegue postar no mural') as v;
create temp table t_family_reads as
  select exists (select 1 from feed_posts where id = '16000000-0000-0000-0000-000000000001') as v;
reset role;

-- terapeuta SEM vínculo ao paciente não consegue postar nem ler
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000009"}';
prepare bad_unlinked_post as
  insert into feed_posts (patient_id, author_id, body)
  values ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000009', 'não deveria conseguir');
create temp table t_bad_unlinked_post as
  select throws_ok('bad_unlinked_post', null, null, 'terapeuta sem vínculo não consegue postar') as v;
create temp table t_unlinked_reads as
  select exists (select 1 from feed_posts where id = '16000000-0000-0000-0000-000000000001') as v;
reset role;

select ok((select v from t_post_exists), 'terapeuta vinculado consegue postar no mural') as result
union all
select v from t_bad_family_post
union all
select ok((select v from t_family_reads), 'responsável vinculado lê o post')
union all
select v from t_bad_unlinked_post
union all
select ok(not (select v from t_unlinked_reads), 'terapeuta sem vínculo não lê o post');

rollback;
