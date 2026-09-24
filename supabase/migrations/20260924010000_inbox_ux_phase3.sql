-- supabase/migrations/20260924010000_inbox_ux_phase3.sql
--
-- UX da inbox de atendimento (app/recepcao/atendimento):
--
-- 1. `last_inbound_at`: quando foi a ÚLTIMA mensagem que o CONTATO mandou.
--    Sem isso a UI não sabia se a janela de serviço de 24h do WhatsApp
--    estava fechada, e a recepção só descobria ao tentar mandar mensagem
--    livre e receber o erro 63016 da Twilio.
-- 2. `last_message_preview`: prévia da última mensagem (de qualquer lado) na
--    lista de conversas — a coluna já existia no tipo do front
--    (ConversationRow.lastMessagePreview) mas nunca era preenchida no banco.
-- 3. `bot_auto_resume_hours`: quantas horas uma conversa `pending` (bot
--    pausado por escalonamento) fica esperando um humano antes do bot
--    voltar a responder sozinho. 0/null = desligado (comportamento atual,
--    só manual pela Central).

alter table twilio_conversations add column if not exists last_inbound_at timestamptz;
alter table twilio_conversations add column if not exists last_message_preview text;

comment on column twilio_conversations.last_inbound_at is 'Timestamp da última mensagem recebida do CONTATO (não conta resposta do bot/agente) — usado para saber se a janela de serviço de 24h do WhatsApp está aberta.';
comment on column twilio_conversations.last_message_preview is 'Prévia (recorte) da última mensagem da conversa, de qualquer direção — evita reconsultar messages só para renderizar a lista.';

alter table chatbot_settings add column if not exists bot_auto_resume_hours int;

comment on column chatbot_settings.bot_auto_resume_hours is 'Horas que uma conversa escalada (status=pending, is_bot_active=false) espera resposta humana antes do bot retomar sozinho. Null/0 = desligado.';

-- Retomada automática do bot — só entra na conversa se: ainda está pendente,
-- o bot está desligado, foi de fato escalada (tem escalated_at — não pega
-- conversa que um humano assumiu manualmente sem escalonamento, já que essa
-- nunca tem escalated_at preenchido) e a clínica configurou um teto > 0.
create or replace function auto_resume_pending_bots()
returns void
language sql
security definer
set search_path = public
as $$
  update twilio_conversations c
     set is_bot_active = true,
         status = 'open',
         escalation_reason = null
    from chatbot_settings s
   where s.clinic_id = c.clinic_id
     and c.status = 'pending'
     and c.is_bot_active = false
     and c.escalated_at is not null
     and coalesce(s.bot_auto_resume_hours, 0) > 0
     and now() - c.escalated_at > (s.bot_auto_resume_hours::text || ' hours')::interval;
$$;

comment on function auto_resume_pending_bots() is 'Reativa o bot em conversas escaladas há mais de chatbot_settings.bot_auto_resume_hours sem resposta humana. Rodada pelo pg_cron a cada hora.';

-- Diferente dos outros jobs pg_cron deste projeto (dispatch_absence_alerts
-- etc.), este não faz HTTP via pg_net: é uma função SQL pura, então não
-- depende de app.settings.app_url/cron_secret nem do pg_net funcionando.
-- Ainda assim, no mesmo bloco protegido dos demais: se pg_cron não estiver
-- disponível/permitido neste ambiente, a migration segue sem travar o resto.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'auto-resume-pending-bots',
    '0 * * * *',
    $job$select auto_resume_pending_bots()$job$
  );
exception when others then
  raise notice 'pg_cron indisponível — job auto-resume-pending-bots não agendado: %', sqlerrm;
end;
$$;
