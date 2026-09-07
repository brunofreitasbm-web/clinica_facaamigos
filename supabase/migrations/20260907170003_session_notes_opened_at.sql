-- supabase/migrations/20260907170003_session_notes_opened_at.sql
-- PRD §9.4, última regra: "O sistema mede o tempo entre abrir e assinar
-- (métrica interna de UX)" — a meta do §1 é ≤ 2 min por sessão.
--
-- created_at_device já é o instante do toque em "Confirmar e assinar";
-- faltava o instante em que a tela abriu. Nullable de propósito: evolução já
-- assinada não tem, e session_notes não aceita UPDATE (append-only), logo
-- backfill é impossível — todo leitor precisa tratar null.
alter table session_notes add column opened_at timestamptz;

alter table session_notes add constraint session_notes_opened_before_signed
  check (opened_at is null or opened_at <= created_at_device);

-- View de leitura da métrica. Fora de refresh_metric_snapshots de propósito:
-- aquela função é reescrita por inteiro a cada migration que a toca (já são
-- quatro), e acrescentar mais uma métrica lá aumenta a chance de um
-- create-or-replace parcial apagar as outras em silêncio.
create view v_session_note_sign_duration as
  select sn.id,
         sn.appointment_id,
         sn.therapist_id,
         a.patient_id,
         sn.version,
         sn.created_at_server,
         extract(epoch from (sn.created_at_device - sn.opened_at))::int as seconds_to_sign
  from session_notes sn
  join appointments a on a.id = sn.appointment_id
  where sn.opened_at is not null;

-- Obrigatório: sem security_invoker a view roda com os privilégios do owner
-- e devolve session_notes por cima da RLS (lint `security_definer_view` dos
-- advisors).
alter view v_session_note_sign_duration set (security_invoker = on);
