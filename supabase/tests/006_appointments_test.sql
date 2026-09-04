begin;
select plan(2);
select has_table('appointments');
select trigger_is('appointments', 'trg_appointments_authorization_guard', 'appointments_authorization_guard');
select * from finish();
rollback;
