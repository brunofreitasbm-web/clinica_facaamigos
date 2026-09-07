-- fono_assessments (20260907170007) — ADL/ADL-2/PROC de fonoaudiologia.
-- Cobre: terapeuta vinculado lê/insere; terapeuta não vinculado não lê;
-- recepção/responsável não leem; rascunho editável pelo autor; concluída
-- rejeita update; supervisor lê tudo da clínica.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000030', 'terapeuta.fono.vinculado@test.local'),
  ('a0000000-0000-0000-0000-000000000031', 'terapeuta.fono.naovinculado@test.local'),
  ('a0000000-0000-0000-0000-000000000032', 'supervisor.fono@test.local'),
  ('a0000000-0000-0000-0000-000000000033', 'recepcao.fono@test.local'),
  ('a0000000-0000-0000-0000-000000000034', 'responsavel.fono@test.local')
on conflict do nothing;

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Vinculado Fono'),
  ('a0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Não Vinculado Fono'),
  ('a0000000-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000001', 'supervisor', 'Supervisor Fono'),
  ('a0000000-0000-0000-0000-000000000033', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção Fono'),
  ('a0000000-0000-0000-0000-000000000034', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável Fono')
on conflict do nothing;

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000001', 'Paciente Fono', '2018-01-01', 'ativo');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000030', 'terapeuta');

-- 1: terapeuta vinculado consegue inserir uma avaliação em rascunho.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
insert into fono_assessments (id, clinic_id, patient_id, instrument, status, test_date, birth_date, age_years, age_months, assessed_by)
values ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000030', 'adl', 'rascunho', '2026-09-07', '2018-01-01', 8, 8, 'a0000000-0000-0000-0000-000000000030');
create temp table t_insert_ok as select true as v;
reset role;

-- 2: terapeuta vinculado lê a própria avaliação.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
create temp table t_vinculado_count as
  select count(*) as v from fono_assessments where id = 'f0000000-0000-0000-0000-000000000001';
reset role;

-- 3: terapeuta não vinculado ao paciente não vê nenhuma avaliação dele.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000031"}';
create temp table t_naovinculado_count as
  select count(*) as v from fono_assessments where patient_id = 'd0000000-0000-0000-0000-000000000030';
reset role;

-- 4: recepção não vê nenhuma (fora do conjunto de papéis autorizados).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000033"}';
create temp table t_recepcao_count as
  select count(*) as v from fono_assessments where patient_id = 'd0000000-0000-0000-0000-000000000030';
reset role;

-- 5: responsável não vê nenhuma.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000034"}';
create temp table t_responsavel_count as
  select count(*) as v from fono_assessments where patient_id = 'd0000000-0000-0000-0000-000000000030';
reset role;

-- 6: supervisor lê a avaliação (papel gestor/supervisor não depende de patient_access).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000032"}';
create temp table t_supervisor_count as
  select count(*) as v from fono_assessments where id = 'f0000000-0000-0000-0000-000000000001';
reset role;

-- 7: rascunho é editável pelo terapeuta vinculado.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
update fono_assessments set observations = 'editado' where id = 'f0000000-0000-0000-0000-000000000001';
create temp table t_update_rascunho as
  select (observations = 'editado') as v from fono_assessments where id = 'f0000000-0000-0000-0000-000000000001';
reset role;

-- 8: uma vez concluída, o update não afeta nenhuma linha (política exige status='rascunho').
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000032"}';
update fono_assessments set status = 'concluida' where id = 'f0000000-0000-0000-0000-000000000001';
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000030"}';
update fono_assessments set observations = 'nao deveria mudar' where id = 'f0000000-0000-0000-0000-000000000001';
create temp table t_update_concluida as
  select (observations = 'editado') as v from fono_assessments where id = 'f0000000-0000-0000-0000-000000000001';
reset role;

select ok((select v from t_insert_ok), 'terapeuta vinculado consegue inserir avaliação em rascunho')
union all
select ok((select v from t_vinculado_count) = 1, 'terapeuta vinculado lê a própria avaliação')
union all
select ok((select v from t_naovinculado_count) = 0, 'terapeuta não vinculado não vê a avaliação do paciente')
union all
select ok((select v from t_recepcao_count) = 0, 'recepção não vê avaliações de fono')
union all
select ok((select v from t_responsavel_count) = 0, 'responsável não vê avaliações de fono')
union all
select ok((select v from t_supervisor_count) = 1, 'supervisor lê a avaliação sem precisar de patient_access')
union all
select ok((select v from t_update_rascunho), 'rascunho é editável pelo terapeuta vinculado')
union all
select ok((select v from t_update_concluida), 'avaliação concluída não é mais editável (update não afeta linhas)');

rollback;
