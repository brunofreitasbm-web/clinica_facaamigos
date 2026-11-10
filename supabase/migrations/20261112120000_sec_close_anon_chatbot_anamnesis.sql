-- Segurança (auditoria 2026-11-10): as policies de 20260906000009 eram
-- `for all using (true)` sem `TO`, valendo para anon (leitura e escrita de CPF,
-- telefone do responsável e nome da criança pela API pública). Passam a valer só
-- para equipe autenticada. O app grava via service_role (ignora RLS) e lê via
-- sessão de staff, então nenhum fluxo legítimo usa anon aqui.
--
-- ROLLBACK:
--   drop policy chatbot_sessions_staff on public.chatbot_sessions;
--   drop policy anamnesis_requests_staff on public.anamnesis_scheduling_requests;
--   create policy chatbot_sessions_admin on public.chatbot_sessions for all using (true) with check (true);
--   create policy anamnesis_requests_admin on public.anamnesis_scheduling_requests for all using (true) with check (true);
--   grant all on public.chatbot_sessions, public.anamnesis_scheduling_requests to anon;

drop policy if exists chatbot_sessions_admin on public.chatbot_sessions;
drop policy if exists anamnesis_requests_admin on public.anamnesis_scheduling_requests;
drop policy if exists chatbot_sessions_staff on public.chatbot_sessions;
drop policy if exists anamnesis_requests_staff on public.anamnesis_scheduling_requests;

create policy chatbot_sessions_staff on public.chatbot_sessions
  for all to authenticated
  using (coalesce((select public.app_current_role()), 'responsavel') <> 'responsavel')
  with check (coalesce((select public.app_current_role()), 'responsavel') <> 'responsavel');

create policy anamnesis_requests_staff on public.anamnesis_scheduling_requests
  for all to authenticated
  using (coalesce((select public.app_current_role()), 'responsavel') <> 'responsavel')
  with check (coalesce((select public.app_current_role()), 'responsavel') <> 'responsavel');

revoke all on public.chatbot_sessions from anon;
revoke all on public.anamnesis_scheduling_requests from anon;
