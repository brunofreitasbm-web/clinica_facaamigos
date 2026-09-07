-- "Cadastro assistido por IA" — rascunhos de documentos enviados por
-- WhatsApp/portal (20260907000001_registration_drafts.sql). Cobre: leitura
-- restrita a recepção/supervisor/gestor da própria clínica, leitura do
-- responsável do próprio envio pelo portal, bloqueio de insert por papel de
-- aplicação (só admin client cria), update de status pela recepção, e os
-- novos CHECKs (sexo/UF/categoria de documento/audit_log.action).
begin;
select plan(9);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000020', 'recepcao.drafts@test.local'),
  ('a0000000-0000-0000-0000-000000000021', 'terapeuta.drafts@test.local'),
  ('a0000000-0000-0000-0000-000000000022', 'responsavel.drafts@test.local'),
  ('a0000000-0000-0000-0000-000000000023', 'recepcao.outraclinica.drafts@test.local')
on conflict do nothing;

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste'),
  ('c0000000-0000-0000-0000-000000000099', 'Outra Clínica')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção Drafts'),
  ('a0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Drafts'),
  ('a0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável Drafts'),
  ('a0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000099', 'recepcao', 'Recepção Outra Clínica')
on conflict do nothing;

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000001', 'Paciente Drafts', '2019-01-01', 'ativo');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000022', 'responsavel');

-- Rascunho de número desconhecido (pré-cadastro, patient_id null).
insert into registration_drafts (id, clinic_id, source, source_phone, status) values
  ('19000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'whatsapp', '+5511999990000', 'extracted');

-- Rascunho do portal, vinculado ao paciente e ao responsável que enviou.
insert into registration_drafts (id, clinic_id, patient_id, source, submitted_by, status) values
  ('19000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000020',
   'portal', 'a0000000-0000-0000-0000-000000000022', 'extracted');

-- 1/2: recepção da própria clínica lê os dois rascunhos.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000020"}';
create temp table t_recepcao_count as
  select count(*) as v from registration_drafts where clinic_id = 'c0000000-0000-0000-0000-000000000001';
reset role;

-- 3: recepção de outra clínica não vê nenhum.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000023"}';
create temp table t_outra_clinica_count as select count(*) as v from registration_drafts;
reset role;

-- 4: terapeuta (fora do conjunto de papéis autorizados) não vê nenhum.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000021"}';
create temp table t_terapeuta_count as select count(*) as v from registration_drafts;
reset role;

-- 5: responsável vê só o próprio envio do portal (não o pré-cadastro nem os
-- de outros pacientes).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000022"}';
create temp table t_responsavel_rows as
  select id::text as v from registration_drafts order by id;
reset role;

-- 6: papel de aplicação (recepção) não consegue inserir — só o client admin
-- (sem RLS) cria rascunhos; throws_ok precisa rodar antes do reset role.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000020"}';
prepare bad_insert_draft as
  insert into registration_drafts (clinic_id, source, source_phone)
  values ('c0000000-0000-0000-0000-000000000001', 'whatsapp', '+5511988880000');
create temp table t_bad_insert as
  select throws_ok('bad_insert_draft', null, null, 'recepção não consegue inserir rascunho diretamente (só client admin)') as v;
reset role;

-- 7: recepção consegue validar (update de status).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000020"}';
update registration_drafts set status = 'validated', validated_by = 'a0000000-0000-0000-0000-000000000020', validated_at = now()
  where id = '19000000-0000-0000-0000-000000000002';
reset role;

create temp table t_validated as
  select (status = 'validated') as v from registration_drafts where id = '19000000-0000-0000-0000-000000000002';

select ok((select v from t_recepcao_count) = 2, 'recepção da clínica lê os dois rascunhos') as result
union all
select ok((select v from t_outra_clinica_count) = 0, 'recepção de outra clínica não vê nenhum rascunho')
union all
select ok((select v from t_terapeuta_count) = 0, 'terapeuta não vê rascunhos (fora do conjunto de papéis)')
union all
select ok(
  (select array_agg(v) from t_responsavel_rows) = array['19000000-0000-0000-0000-000000000002'],
  'responsável só vê o próprio envio do portal'
)
union all
select v from t_bad_insert
union all
select ok((select v from t_validated), 'recepção consegue marcar o rascunho como validated')
union all
select throws_ok(
  $$insert into patients (clinic_id, full_name, birth_date, sexo) values ('c0000000-0000-0000-0000-000000000001','X','2020-01-01','X')$$,
  null, null, 'sexo fora de F/M/outro viola o CHECK'
)
union all
select throws_ok(
  $$insert into patients (clinic_id, full_name, birth_date, address_uf) values ('c0000000-0000-0000-0000-000000000001','X','2020-01-01','sp')$$,
  null, null, 'UF minúscula viola o CHECK (exige 2 letras maiúsculas)'
)
union all
select lives_ok(
  $$insert into documents (patient_id, category, storage_path, uploaded_by) values ('d0000000-0000-0000-0000-000000000020','certidao_nascimento','x/y','a0000000-0000-0000-0000-000000000020')$$,
  'categoria certidao_nascimento é aceita pelo CHECK de documents'
);

rollback;
