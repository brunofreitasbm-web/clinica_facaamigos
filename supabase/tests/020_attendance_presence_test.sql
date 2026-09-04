-- Item 3 do PRD "11 incrementos": presença em tempo real. Sem novos valores
-- de status (ver lib/appointment-ui-state.ts) — só a coluna nova que
-- distingue "Na Recepção" (checkin_at) de "Em Atendimento"
-- (attendance_started_at), e replica identity full (necessária pro
-- Realtime entregar o valor anterior de checkin_at no payload de UPDATE).
begin;
select plan(2);

select has_column('appointments', 'attendance_started_at');

select ok(
  (select relreplident from pg_class where relname = 'appointments') = 'f',
  'appointments usa replica identity full (payload de UPDATE do Realtime traz old completo)'
);

select * from finish();
rollback;
