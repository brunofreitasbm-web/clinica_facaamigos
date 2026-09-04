begin;
select plan(2);
select col_not_null('protocols', 'digitization_risk_accepted_by');
select col_not_null('protocols', 'digitization_risk_accepted_at');
select * from finish();
rollback;
