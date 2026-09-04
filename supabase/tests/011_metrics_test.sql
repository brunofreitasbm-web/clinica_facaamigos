-- supabase/tests/011_metrics_test.sql
-- Test suite for metrics schema: targets, metric_snapshots, survey_responses

begin;
select plan(3);

-- Step 1: Verify tables exist
select has_table('targets');
select has_table('metric_snapshots');
select has_table('survey_responses');

select * from finish();
rollback;
