-- Quem da equipe enviou a mensagem (NULL = bot, cron ou contato).
--
-- Motivo: o botão "Enviar menu" da recepção grava a mensagem como `sender_type='bot'`
-- para a família não notar a intervenção, e no histórico ficava idêntico a um menu
-- espontâneo (10 casos em 30 dias, 5 deles em conversas mudas há mais de 30 dias).
-- Com `sent_by` a tela mostra "Menu enviado por Fulana" sem mudar nada para a família.

alter table messages
  add column if not exists sent_by uuid references profiles(id) on delete set null;

comment on column messages.sent_by is
  'Profissional da equipe que enviou a mensagem pelo CRM. NULL: bot, cron ou contato.';
