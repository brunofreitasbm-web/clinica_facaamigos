-- supabase/migrations/20260913110000_twilio_conversations_internal_note.sql
-- Nota interna da conversa na Central de Atendimento: recado entre recepção e
-- supervisão ("mãe pediu retorno depois das 17h", "aguardando guia do plano").
-- Nunca é enviada ao contato. Fica na própria conversa (e não em `messages`)
-- para não se misturar ao histórico do WhatsApp nem aos relatórios do bot.
-- As policies de select/update de twilio_conversations já cobrem a coluna.

alter table twilio_conversations
  add column internal_note text,
  add column internal_note_updated_at timestamptz;
