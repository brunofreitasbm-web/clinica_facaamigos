-- supabase/migrations/20260906000025_revoke_book_anamnesis_slot_atomic_execute.sql
-- book_anamnesis_slot_atomic é SECURITY DEFINER e só deve ser chamada pelo
-- backend (webhook Twilio, via service role/createAdminClient) após validar
-- a aprovação do supervisor. Exposta a anon/authenticated ela permitiria
-- criar pacientes e agendamentos direto pela REST API sem qualquer checagem
-- de identidade da família ou de aprovação.
revoke execute on function book_anamnesis_slot_atomic(uuid, uuid, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
