-- supabase/migrations/20260909200000_chatbot_settings.sql
-- Configurações globais do chatbot de WhatsApp, editáveis na nova aba
-- "Chatbot" da Central de Atendimento (app/recepcao/atendimento/chatbot).
-- Antes disso, o teto diário de respostas do bot de FAQ e a saudação de
-- fallback estavam hardcoded em lib/twilio-faq-bot.ts e lib/twilio.ts.

create table chatbot_settings (
  clinic_id uuid primary key references clinics(id),
  bot_enabled boolean not null default true,
  daily_reply_limit int not null default 20,
  greeting_fallback text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table chatbot_settings enable row level security;

-- Mesmo conjunto de papéis que já administra clinic_faq/quick_responses/
-- message_templates (ver 20260909110000_clinic_faq.sql e
-- 20260906000010_twilio_conversations.sql) — configuração do bot é
-- atribuição de Supervisão/Gestão, não de Recepção.
create policy chatbot_settings_read on chatbot_settings for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

create policy chatbot_settings_manage on chatbot_settings for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

-- Semente com os valores default que já estavam hardcoded, para a linha
-- existir em runtime (os bots leem via service role, que ignora RLS, mas
-- dependem da linha existir para não cair sempre no default do app).
insert into chatbot_settings (clinic_id, bot_enabled, daily_reply_limit, greeting_fallback)
values ('c0000000-0000-0000-0000-000000000001', true, 20, null)
on conflict (clinic_id) do nothing;
