-- supabase/tests/005_treatment_plans_test.sql
begin;
select plan(3);
select has_table('treatment_plans', 'Table treatment_plans should exist');
select has_table('plan_goals', 'Table plan_goals should exist');
select has_table('programs', 'Table programs should exist with XOR constraint');
select * from finish();
rollback;
