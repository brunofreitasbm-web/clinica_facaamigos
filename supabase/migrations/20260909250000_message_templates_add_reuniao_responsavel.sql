-- supabase/migrations/20260909250000_message_templates_add_reuniao_responsavel.sql
--
-- Categoria de template pro convite/confirmação de "Marcar reunião" na
-- Caixa de entrada (app/supervisao/inbox-panel.tsx) via Twilio Content API,
-- pra quando a janela de 24h de serviço já fechou.
alter table message_templates drop constraint if exists message_templates_category_check;

alter table message_templates add constraint message_templates_category_check
  check (category in (
    'falta',
    'cobranca',
    'aniversario',
    'renovacao_guia',
    'otp',
    'pre_anamnese',
    'nps',
    'triagem_convenio',
    'reuniao_responsavel',
    'outro'
  ));

insert into message_templates (clinic_id, category, name, channel, body, meta_approved, active)
select
  c.id,
  'reuniao_responsavel',
  'Convite / confirmação de reunião com responsável',
  'whatsapp',
  'Olá, {{1}}! Gostaríamos de agendar uma breve reunião sobre o acompanhamento de {{2}} na {{3}}. Poderia nos confirmar um horário?',
  true,
  true
from clinics c
where not exists (
  select 1 from message_templates mt where mt.clinic_id = c.id and mt.category = 'reuniao_responsavel'
);
