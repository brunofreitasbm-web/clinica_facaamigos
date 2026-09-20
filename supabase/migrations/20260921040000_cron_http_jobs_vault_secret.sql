-- supabase/migrations/20260921040000_cron_http_jobs_vault_secret.sql
--
-- Os 5 jobs de pg_cron que chamam a API por HTTP NUNCA rodaram — 100% de
-- falha desde que foram criados (19.074 falhas só no de extração de
-- rascunhos). Todos montavam a URL a partir de
-- `current_setting('app.settings.app_url', true)`, que nunca foi definido, e
-- o pg_net recusava:
--
--   ERROR: invalid URL "/api/extractions/process": Bad scheme
--
-- Consequência em produção: `registration_drafts` acumulando em
-- `status='pending'`, `attempts=0` — arquivos salvos em `clinic-documents`,
-- mas nenhum extraído e nenhum promovido a lead.
--
-- Por que não basta configurar o GUC: no Supabase o papel `postgres` não é
-- superuser (`usesuper = false`), então
-- `alter database postgres set "app.settings.app_url" = ...` é recusado com
-- "permission denied to set parameter" — tanto por conexão externa quanto
-- pelo SQL Editor do painel, que também roda como `postgres`. Esse caminho
-- não existe neste projeto.
--
-- Correção:
--  1. A URL do sistema NÃO é segredo — passa a ficar literal no comando.
--  2. O segredo do cron vai para o Supabase Vault, com o nome `cron_secret`.
--     `postgres` é dono dos jobs e lê `vault.decrypted_secrets`.
--
-- O segredo precisa ser criado UMA vez (fora desta migration, para não entrar
-- no repositório) e precisa ser o MESMO valor da env `CRON_SECRET` da Vercel:
--
--   select vault.create_secret('<valor>', 'cron_secret', 'Header x-cron-secret dos jobs de pg_cron');
--
-- Enquanto ele não existir, o header vai vazio e as rotas respondem 401 —
-- falha explícita e auditável, em vez do erro mudo de antes.

do $migration$
declare
  base_url constant text := 'https://sistema.institutofacaamigos.com.br';
  target record;
begin
  for target in
    select * from (values
      (3,  '/api/twilio/nps/trigger'),
      (10, '/api/twilio/absence/trigger'),
      (11, '/api/twilio/anamnesis-prefill/trigger'),
      (12, '/api/extractions/process'),
      (13, '/api/intake/process')
    ) as t(job_id, path)
  loop
    -- Só mexe no job se ele ainda existir com esse id (bancos recriados do
    -- zero numerariam diferente; aí as migrations originais já criam certo).
    if exists (select 1 from cron.job where jobid = target.job_id) then
      perform cron.alter_job(
        job_id := target.job_id,
        command := format(
          $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
            ''
          )
        ),
        body := '{}'::jsonb
      );
    $cmd$,
          base_url || target.path
        )
      );
    end if;
  end loop;
end
$migration$;
