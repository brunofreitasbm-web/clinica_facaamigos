begin;
select plan(1);
select trigger_is('patients', 'trg_audit_patients', 'fn_audit_log');
select * from finish();
rollback;
