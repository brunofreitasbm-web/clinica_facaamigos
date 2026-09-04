-- supabase/tests/007b_session_notes_therapist_fix_test.sql
-- Verifica que session_notes_insert foi corrigido para exigir appointment.therapist_id = auth.uid()
-- (rejeita impersonation: therapist A não pode inserir notas em appointments de therapist B)

begin;
select plan(3);

-- TEST 1: Policy session_notes_insert existe
select ok(
  exists(
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname = 'session_notes' and p.polname = 'session_notes_insert'
  ),
  'Policy session_notes_insert existe na tabela session_notes'
);

-- TEST 2: Verifica que a policy contém 'a.therapist_id = auth.uid()' (check identity real)
select ok(
  exists(
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname = 'session_notes'
      and p.polname = 'session_notes_insert'
      and p.polcmd = 'a'  -- INSERT
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%a.therapist_id = auth.uid()%'
  ),
  'session_notes_insert valida a.therapist_id = auth.uid() (therapist real da appointment)'
);

-- TEST 3: Supervisors foram removidos da política (não aparece app_current_role)
select ok(
  not exists(
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname = 'session_notes'
      and p.polname = 'session_notes_insert'
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%app_current_role%'
  ),
  'session_notes_insert não contém exceção de supervisor (removida per "tudo tem autor" PRD)'
);

select * from finish();
rollback;
