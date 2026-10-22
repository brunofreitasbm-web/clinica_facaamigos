-- supabase/migrations/20261021000000_ai_usage_deepseek_provider.sql
-- Libera 'deepseek' como provider em ai_usage_log / ai_model_prices (chat passou a usar
-- DeepSeek primeiro, Gemini como reserva — lib/chat-llm.ts). Sem isto o INSERT do log
-- falha no CHECK (só registra erro no console; o chat continua funcionando).
--
-- NÃO inserimos linha em ai_model_prices: o preço vigente do deepseek-chat precisa ser
-- conferido em api-docs.deepseek.com/quick_start/pricing e cadastrado pelo gestor.
-- Enquanto não houver preço, o custo desse provider fica sem valorização nas views.

alter table ai_usage_log drop constraint ai_usage_log_provider_check;
alter table ai_usage_log add constraint ai_usage_log_provider_check
  check (provider in ('gemini', 'anthropic', 'deepseek'));

alter table ai_model_prices drop constraint ai_model_prices_provider_check;
alter table ai_model_prices add constraint ai_model_prices_provider_check
  check (provider in ('gemini', 'anthropic', 'deepseek'));
