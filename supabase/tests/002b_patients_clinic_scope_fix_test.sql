begin;
select plan(1);

-- Test 1: Verify that all three corrected policies exist
select is(
  (select count(*) from pg_policies
   where schemaname = 'public'
   and policyname in ('guardians_write_recepcao', 'patient_access_read', 'patient_access_manage')),
  3::bigint,
  'Three clinic-scoped policies should exist'
);

select * from finish();
rollback;
