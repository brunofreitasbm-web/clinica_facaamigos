-- Migration: Atualiza templates do chatbot para reabrir conversas com mais de 24h e remove a categoria cobrança.

alter table message_templates drop constraint if exists message_templates_category_check;

alter table message_templates add constraint message_templates_category_check
  check (category in (
    'falta',
    'reabertura_atendimento',
    'aniversario',
    'renovacao_guia',
    'otp',
    'pre_anamnese',
    'nps',
    'triagem_convenio',
    'reuniao_responsavel',
    'confirmacao_d1',
    'outro'
  ));

-- Converte templates legados de 'cobranca' para 'reabertura_atendimento'
update message_templates
set
  category = 'reabertura_atendimento',
  name = 'Reabertura de Atendimento (>24h)',
  body = 'Olá, {{1}}! Podemos dar continuidade no seu atendimento?'
where category = 'cobranca';

-- Garante que todas as clínicas ativas tenham o template de reabertura de atendimento (>24h)
insert into message_templates (clinic_id, category, name, channel, body, meta_approved, active)
select
  c.id,
  'reabertura_atendimento',
  'Reabertura de Atendimento (>24h)',
  'whatsapp',
  'Olá, {{1}}! Podemos dar continuidade no seu atendimento?',
  true,
  true
from clinics c
where not exists (
  select 1 from message_templates mt where mt.clinic_id = c.id and mt.category = 'reabertura_atendimento'
);

-- Adiciona a resposta rápida /reabrir na Central de Atendimento
insert into quick_responses (clinic_id, shortcut, title, content_text)
select id, '/reabrir', 'Reabertura (>24h)', 'Olá! Podemos dar continuidade no seu atendimento?'
from clinics
on conflict (clinic_id, shortcut) do update
set content_text = 'Olá! Podemos dar continuidade no seu atendimento?';
