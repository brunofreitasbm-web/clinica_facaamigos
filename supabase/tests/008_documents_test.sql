-- supabase/tests/008_documents_test.sql
-- Tests for documents table and RLS policies

begin;
select plan(1);
select col_has_check('documents', 'category');
select * from finish();
rollback;
