-- supabase/migrations/20260904000028_revoke_cron_function_public_execute.sql
--
-- Achado do linter de segurança do Supabase (0028/0029): toda função
-- SECURITY DEFINER em `public` é auto-exposta como RPC do PostgREST
-- (`/rest/v1/rpc/<nome>`), inclusive pra `anon`. close_monthly_metric_snapshots()
-- (000027) e refresh_reassessment_alerts() (000019) só deveriam rodar via
-- pg_cron — não fazem sentido como endpoint público, e um chamador anônimo
-- repetido poderia forçar recomputo indevido (nenhuma delas recebe
-- parâmetro pra restringir o efeito). Revoga execução pública; pg_cron
-- continua funcionando porque roda com o privilégio de quem chamou
-- `cron.schedule` na migration, não como anon/authenticated.
revoke execute on function close_monthly_metric_snapshots() from public, anon, authenticated;
revoke execute on function refresh_reassessment_alerts() from public, anon, authenticated;
