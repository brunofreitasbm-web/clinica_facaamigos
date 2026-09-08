-- supabase/migrations/20260908030000_nps_externo_portal_only.sql
--
-- NPS Externo (Pacientes & Famílias) deixa de ser enviado via Twilio/WhatsApp:
-- passa a ser respondido só pelo portal da família. As rotas de disparo
-- (/api/twilio/nps/trigger e /api/twilio/nps-mensal/trigger) continuam
-- rodando pelo mesmo pg_cron, mas agora só criam o registro pendente em
-- nps_surveys (sem enviar mensagem) — falta dar ao responsável um jeito de
-- ler e responder essa pesquisa pendente, o que nps_surveys nunca teve
-- (só existia policy de leitura para gestor/supervisor e update de
-- alert_status, ver 20260906000011_nps_surveys.sql).
--
-- 1) Leitura da própria pesquisa pendente, mesmo padrão de
-- survey_responses_write/family_feedback_write (guardian.profile_id =
-- auth.uid()).
create policy nps_surveys_guardian_read on nps_surveys for select
  using (
    exists (
      select 1 from guardians g
      where g.id = nps_surveys.guardian_id
        and g.profile_id = auth.uid()
    )
  );

-- 2) Resposta via função security definer, não via policy de UPDATE aberta:
-- RLS não restringe QUAIS colunas são alteradas, só QUAIS linhas — uma
-- policy de update para o responsável deixaria ele alterar alert_status,
-- phone_number etc. Mesmo padrão de confirm_attendance
-- (20260904000030_family_confirm_attendance.sql): guarda explícita de posse,
-- de "ainda não respondida" e da faixa de nota por trigger_type (1-5 nos
-- disparos por evento, 0-10 no mensal — mesma regra que antes vivia no
-- webhook do Twilio, lib/twilio.ts).
create function submit_nps_response(p_survey_id uuid, p_score int, p_feedback text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  survey nps_surveys%rowtype;
  min_score int;
  max_score int;
  is_detractor boolean;
begin
  select * into survey from nps_surveys where id = p_survey_id for update;
  if not found then
    raise exception 'Pesquisa não encontrada.';
  end if;

  if not exists (
    select 1 from guardians g
    where g.id = survey.guardian_id and g.profile_id = auth.uid()
  ) then
    raise exception 'Sem permissão para responder esta pesquisa.';
  end if;

  if survey.responded_at is not null then
    raise exception 'Esta pesquisa já foi respondida.';
  end if;

  min_score := case when survey.trigger_type = 'mensal' then 0 else 1 end;
  max_score := case when survey.trigger_type = 'mensal' then 10 else 5 end;
  if p_score < min_score or p_score > max_score then
    raise exception 'Nota fora da faixa permitida.';
  end if;

  is_detractor := case when survey.trigger_type = 'mensal' then p_score <= 6 else p_score <= 3 end;

  update nps_surveys
  set score = p_score,
      feedback_text = nullif(trim(p_feedback), ''),
      responded_at = now(),
      alert_status = case when is_detractor then 'pending_contact' else survey.alert_status end
  where id = p_survey_id;
end;
$$;

-- Só `authenticated` chama via RPC (a checagem de posse é feita dentro da
-- função) — nunca `anon`, mesmo cuidado de confirm_attendance.
revoke execute on function submit_nps_response(uuid, int, text) from public, anon;
grant execute on function submit_nps_response(uuid, int, text) to authenticated;
