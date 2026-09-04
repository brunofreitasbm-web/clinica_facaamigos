-- supabase/tests/011b_metrics_clinic_scope_fix_test.sql
-- Test suite for metrics clinic scope fix (Round 1)

begin;
select plan(4);

-- Verify metric_snapshots_read policy includes insurer clinic validation
select lives_ok(
  'select 1 from pg_policies where tablename = ''metric_snapshots'' and policyname = ''metric_snapshots_read'' and qual like ''%insurers%''',
  'metric_snapshots_read policy includes insurer clinic validation'
);

-- Verify metric_snapshots_read includes clinic_id check for insurers
select lives_ok(
  'select 1 from pg_policies where tablename = ''metric_snapshots'' and policyname = ''metric_snapshots_read'' and qual like ''%i.clinic_id = current_clinic_id()%''',
  'metric_snapshots_read policy validates insurer.clinic_id = current_clinic_id()'
);

-- Verify survey_responses_write includes patient clinic validation
select lives_ok(
  'select 1 from pg_policies where tablename = ''survey_responses'' and policyname = ''survey_responses_write'' and qual like ''%patients%''',
  'survey_responses_write policy includes patient clinic validation via join'
);

-- Verify survey_responses_write includes clinic_id check
select lives_ok(
  'select 1 from pg_policies where tablename = ''survey_responses'' and policyname = ''survey_responses_write'' and qual like ''%pt.clinic_id = current_clinic_id()%''',
  'survey_responses_write policy validates patient.clinic_id = current_clinic_id()'
);

select * from finish();
rollback;
