-- supabase/migrations/20260904000020_attendance_presence.sql
-- Item 3 do PRD "11 incrementos": presença em tempo real (Confirmado / Na
-- Recepção / Em Atendimento / Falta). O design existente (ver
-- lib/appointment-ui-state.ts) deriva o estado de presença de
-- status + checkin_at + checkout_at, sem valores novos no enum de
-- `status` — mantemos essa convenção em vez de adicionar
-- 'na_recepcao'/'em_atendimento' ao check constraint.
--
-- checkin_at já significa "chegou/check-in feito pela recepção" (Na
-- Recepção). Faltava diferenciar isso de "terapeuta iniciou o atendimento"
-- (Em Atendimento) — daí a nova coluna abaixo, sem mexer no enum de status.
alter table appointments add column attendance_started_at timestamptz;

-- Habilita Realtime na tabela para o toast ao vivo no dashboard do
-- terapeuta quando a recepção faz check-in. `replica identity full` é
-- necessário pro payload de UPDATE trazer o valor anterior de checkin_at
-- (senão só vem a PK em `old`), e a tabela precisa estar na publication
-- supabase_realtime pra ligar o Realtime nela.
alter table appointments replica identity full;

do $$
begin
  alter publication supabase_realtime add table appointments;
exception when others then
  raise notice 'supabase_realtime indisponível ou appointments já publicada: %', sqlerrm;
end;
$$;
