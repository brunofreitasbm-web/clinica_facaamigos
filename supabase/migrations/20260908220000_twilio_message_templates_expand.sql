-- Migration: Expande categorias de templates de mensagem para suportar todos os fluxos Twilio Content API.

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
    'outro'
  ));

-- Insere templates padrão para clínicas ativas que ainda não possuem templates cadastrados nestas categorias
insert into message_templates (clinic_id, category, name, channel, body, meta_approved, active)
select 
  c.id as clinic_id,
  t.category,
  t.name,
  t.channel,
  t.body,
  true as meta_approved,
  true as active
from clinics c
cross join (
  values 
    ('otp', 'Código de Autenticação / OTP', 'sms', 'Seu código de verificação é {{1}}. Válido por 5 minutos.'),
    ('falta', 'Notificação de Falta em Sessão', 'whatsapp', 'Olá, {{1}}. Notamos a ausência do paciente {{2}} na sessão de hoje ({{3}} às {{4}}h). Responda com 1, 2 ou 3 para reagendar nos seguintes horários livres: {{5}}'),
    ('pre_anamnese', 'Convite Pré-Anamnese', 'whatsapp', 'Olá, {{1}}! Para preparar o primeiro atendimento de {{2}}, preencha as informações no link seguro: {{3}}'),
    ('triagem_convenio', 'Acolhimento Plano de Saúde', 'whatsapp', 'Olá, {{1}}! Para verificar a cobertura do plano {{2}} para {{3}}, envie foto/PDF do Laudo e Guia por este canal.'),
    ('nps', 'Pesquisa de Satisfação NPS', 'whatsapp', 'Olá, {{1}}! Em uma escala de 0 a 10, como você avalia os serviços prestados a {{2}} na clínica {{3}}? Responda ou acesse {{4}}'),
    ('renovacao_guia', 'Alerta de Renovação de Guia', 'whatsapp', 'Atenção {{1}}: A autorização do convênio {{2}} para {{3}} vence em {{4}}. Envie a nova guia para manter o tratamento.'),
    ('cobranca', 'Lembrete de Cobrança', 'whatsapp', 'Olá, {{1}}. A fatura de {{2}} referente a {{3}} está disponível. Link/Pix: {{4}}')
) as t(category, name, channel, body)
where not exists (
  select 1 from message_templates mt where mt.clinic_id = c.id and mt.category = t.category
);
