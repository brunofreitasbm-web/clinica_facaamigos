begin;
select plan(1);
select is_empty(
  $$ select polname from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     where c.relname = 'session_notes' and pol.polcmd in ('u','d') $$,
  'session_notes não tem nenhuma policy de UPDATE ou DELETE'
);
select * from finish();
rollback;
