-- supabase/migrations/20260921010000_chatbot_card_number_guia_optional.sql
-- Chatbot de agendamento: em todo atendimento por convênio (não particular)
-- o bot pede a carteirinha do plano E o número do cartão; a guia autorizada
-- deixa de ser obrigatória — se o responsável não tiver, a clínica autoriza.

-- 1. Fluxo direto (lib/twilio-anamnesis-bot.ts): número do cartão digitado
-- pelo responsável, ao lado das fotos da carteirinha.
alter table anamnesis_scheduling_requests
  add column if not exists card_number text,
  -- Atendimento particular: sem laudo, guia, carteirinha nem número de cartão.
  add column if not exists is_private boolean not null default false;

-- 2. FAQ: a resposta sobre encaminhamento dizia que o convênio exige guia
-- autorizada. Agora a guia é bem-vinda, mas opcional.
update clinic_faq
set
  answer = 'Pelo particular, não precisa de nada disso pra começar 😊 Pelo convênio, o seu plano costuma pedir: pedido médico (com CID) + carteirinha do plano (foto e número do cartão). A guia autorizada é bem-vinda, mas não é obrigatória — se ainda não tiver, a gente autoriza aqui na clínica. Pode me mandar os documentos por aqui, foto ou PDF — nossa equipe confere tudo antes da sua avaliação.',
  updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Preciso de encaminhamento médico?';
