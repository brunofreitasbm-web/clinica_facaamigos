begin;
select plan(1);
select has_table('patients');
select * from finish();
rollback;
