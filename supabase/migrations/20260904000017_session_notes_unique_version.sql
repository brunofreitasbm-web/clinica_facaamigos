-- supabase/migrations/20260904000017_session_notes_unique_version.sql
-- Impede duas linhas de session_notes com o mesmo (appointment_id, version) —
-- fecha o TOCTOU do check-then-insert em createSessionNote (achado do review
-- final da evolução clínica mínima). Compatível com o modelo de versionamento
-- futuro: version=2 continua inserindo normalmente.
create unique index session_notes_appointment_version_key
  on session_notes (appointment_id, version);
