-- Item 9 do PRD "11 incrementos": agente IA pra relatório devolutivo.
-- Cobre a RLS de draft_reports — nunca visível à família, só terapeuta
-- vinculado/supervisor/gestor.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000017', 'terapeuta.relatorio@test.local'),
  ('a0000000-0000-0000-0000-000000000018', 'terapeuta.outro.relatorio@test.local'),
  ('a0000000-0000-0000-0000-000000000019', 'responsavel.relatorio@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Relatório'),
  ('a0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Sem Vínculo'),
  ('a0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável Relatório')
on conflict do nothing;

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 'Paciente Relatório', '2018-01-01', 'ativo');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000017', 'terapeuta'),
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000019', 'responsavel');

-- terapeuta vinculado consegue inserir
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000017"}';
insert into draft_reports (id, patient_id, period_start, period_end, generated_by, ai_draft) values
  ('1d000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000008', '2026-01-01', '2026-01-31',
   'a0000000-0000-0000-0000-000000000017', 'rascunho gerado pela IA');
reset role;

create temp table t1 as select exists (select 1 from draft_reports where id = '1d000000-0000-0000-0000-000000000001') as v;

-- terapeuta sem vínculo não consegue ler nem inserir
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000018"}';
create temp table t2 as select is_empty(
  $$ select 1 from draft_reports where id = '1d000000-0000-0000-0000-000000000001' $$
) as v;
prepare bad_unlinked_draft as
  insert into draft_reports (patient_id, period_start, period_end, generated_by)
  values ('d0000000-0000-0000-0000-000000000008', '2026-01-01', '2026-01-31', 'a0000000-0000-0000-0000-000000000018');
create temp table t3 as select throws_ok('bad_unlinked_draft', null, null, 'terapeuta sem vínculo não consegue criar draft_report') as v;
reset role;

-- responsável (família) NUNCA lê draft_reports diretamente
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000019"}';
create temp table t4 as select is_empty($$ select 1 from draft_reports $$) as v;
reset role;

select ok((select v from t1), 'terapeuta vinculado consegue gerar um draft_report') as result
union all select v from t2
union all select v from t3
union all select v from t4;

rollback;
