-- Registra quando a operadora abriu o WhatsApp com a confirmação do agendamento
-- (envio manual via wa.me). Serve para avisar "já confirmado" e evitar mensagem repetida.
alter table playground_visits add column confirmation_sent_at timestamptz;
