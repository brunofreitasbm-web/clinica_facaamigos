-- supabase/migrations/20261022120100_chatbot_faq_convenios_token.sql
-- APLICAR SÓ DEPOIS do deploy do código que entende o token {{convenios}}
-- (lib/faq-rules-pure.ts › expandFaqTokens, usado por lib/twilio-faq-bot.ts).
-- Antes disso, o código antigo enviaria "{{convenios}}" literalmente à família.
-- Separada da 20261022120000 de propósito.

-- 2.4 Convênios: os nomes estavam escritos à mão no texto ("IASEP e PROASA") e
-- divergiam da lista cadastrada. {{convenios}} é trocado em tempo de execução
-- pelos convênios ativos (lib/faq-rules-pure.ts › expandFaqTokens).
update clinic_faq
set answer = 'Trabalhamos com convênios parceiros e também no particular. Atendemos *{{convenios}}*; estamos atuando para credenciar outros planos e em breve nossa rede de convênios aumentará. Para os planos que não atendemos diretamente, emitimos nota fiscal e relatório para você solicitar o *reembolso*. 💛',
    updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Vocês atendem quais plano de saúde?';
