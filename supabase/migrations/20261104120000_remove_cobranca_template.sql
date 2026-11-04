-- Remove o modelo de mensagem da categoria "Cobrança" (descontinuado).
-- A constraint de categoria é mantida (linhas históricas/compatibilidade).
delete from public.message_templates where category = 'cobranca';
