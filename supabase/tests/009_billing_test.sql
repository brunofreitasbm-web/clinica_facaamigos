-- Task 9: Teste pgTAP para faturamento
-- Verifica trigger billing_items_requires_session_note

begin;
select plan(1);
select trigger_is('billing_items', 'trg_billing_items_requires_session_note', 'billing_items_requires_session_note');
select * from finish();
rollback;
