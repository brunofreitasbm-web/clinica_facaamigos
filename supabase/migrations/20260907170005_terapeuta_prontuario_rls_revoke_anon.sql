-- supabase/migrations/20260907170005_terapeuta_prontuario_rls_revoke_anon.sql
-- Segue o padrão do restante do projeto (dezenas de funções na mesma
-- situação, inclusive family_guidance_feed): "revoke all ... from public"
-- não tira o acesso de `anon`/`authenticated` quando o projeto tem
-- ALTER DEFAULT PRIVILEGES concedendo EXECUTE a esses papéis diretamente,
-- fora de PUBLIC (confirmado via information_schema.routine_privileges).
-- Não corrigir as pré-existentes (fora de escopo desta feature), mas as
-- duas funções novas não devem ficar chamáveis por `anon` sem login.
revoke execute on function patient_contact_summary(uuid) from anon;
revoke execute on function patient_authorization_summary(uuid) from anon;
