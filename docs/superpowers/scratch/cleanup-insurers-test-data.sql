-- ==============================================================================
-- SCRIPT DE REMOÇÃO DE PLANOS DE SAÚDE E CONVÊNIOS DE TESTE (PRODUÇÃO)
-- Clinica Faça Amigos
-- ==============================================================================

-- INSTRUÇÕES DE USO NO SUPABASE SQL EDITOR:
-- 1. Acesse o SQL Editor do Supabase.
-- 2. Execute o comando abaixo para listar todos os convênios atuais:
SELECT id, name, ans_code FROM public.insurers ORDER BY name;

-- 3. Para apagar especificamente o convênio fictício de teste "Convênio Teste Task7":
DELETE FROM public.insurers 
WHERE name ILIKE '%Convênio Teste%' 
   OR name ILIKE '%Task7%' 
   OR ans_code = '99999';

-- 4. Para apagar QUALQUER convênio de teste mantendo apenas os oficiais se necessário:
-- DELETE FROM public.insurers WHERE name ILIKE '%Teste%';
