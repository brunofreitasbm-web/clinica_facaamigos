-- supabase/tests/007c_session_notes_supervisor_restore_test.sql
-- Valida que session_notes_insert permite supervisor inserir com identidade honesta
-- (therapist_id = auth.uid(), nunca impersonando)

begin;
select plan(2);

-- TEST 1: Policy contém validação de therapist_id = auth.uid()
-- Verifica que sempre exige identidade honesta (nunca permite impersonation)
select ok(
  exists(
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname = 'session_notes'
      and p.polname = 'session_notes_insert'
      and p.polcmd = 'a'
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%therapist_id = auth.uid()%'
  ),
  'Policy exige therapist_id = auth.uid() — identidade honesta obrigatória (sem impersonation)'
);

-- TEST 2: Policy contém branca de supervisor para qualquer appointment da clínica
-- Verifica que supervisor pode inserir em appointments que não são seus (mas com therapist_id = auth.uid())
select ok(
  exists(
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname = 'session_notes'
      and p.polname = 'session_notes_insert'
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%app_current_role() = ''supervisor''%'
  ),
  'Policy permite supervisor inserir em qualquer appointment da clínica (com therapist_id=próprio uid como autor)'
);

select * from finish();
rollback;
