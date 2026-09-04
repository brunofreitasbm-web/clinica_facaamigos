-- supabase/tests/010_payouts_test.sql
-- pgTAP tests for payouts and payout_items tables

begin;
select plan(6);

-- Test 1: payouts table exists
select has_table('payouts');

-- Test 2: payout_items table exists
select has_table('payout_items');

-- Test 3: payouts has required columns
select has_column('payouts', 'id');
select has_column('payouts', 'therapist_id');
select has_column('payouts', 'competence_month');
select has_column('payouts', 'sessions_count');

select * from finish();
rollback;
