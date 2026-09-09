-- supabase/migrations/20260909140000_twilio_realtime_publication.sql
-- A Central de Atendimento (app/recepcao/atendimento/atendimento-shell.tsx)
-- assina postgres_changes em twilio_conversations e messages para atualizar
-- ao vivo quando chega mensagem nova do WhatsApp. Sem estar na publicação
-- supabase_realtime, o Postgres nunca emite os eventos e a tela só reflete
-- mensagens novas depois de um F5 manual — a receptora via a Central "vazia"
-- mesmo com a conversa já salva no banco.
alter publication supabase_realtime add table twilio_conversations;
alter publication supabase_realtime add table messages;
