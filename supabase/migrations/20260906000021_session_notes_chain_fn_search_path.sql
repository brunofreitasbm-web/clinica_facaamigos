-- supabase/migrations/20260906000021_session_notes_chain_fn_search_path.sql
-- Advisor de segurança (function_search_path_mutable) acusou
-- validate_session_note_chain() sem search_path fixo logo após criada em
-- 20260906000020 — corrige antes que vire hábito.
alter function validate_session_note_chain() set search_path = public, pg_temp;
