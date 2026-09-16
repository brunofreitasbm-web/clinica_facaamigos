-- ==============================================================================
-- SCRIPT DE LIMPEZA / ARQUIVAMENTO DE DADOS DE TESTE E DEMONSTRAÇÃO (PRODUÇÃO)
-- Clinica Faça Amigos
-- ==============================================================================

-- INSTRUÇÕES DE USO NO SUPABASE SQL EDITOR:
-- 1. Copie o conteúdo deste script.
-- 2. Cole e execute no SQL Editor do seu projeto Supabase.
-- 3. Escolha entre a OPÇÃO A (Arquivamento/Desativação Recomendada) ou OPÇÃO B (Remoção Definitiva).

--------------------------------------------------------------------------------
-- OPÇÃO A: ARQUIVAMENTO / DESATIVAÇÃO (RECOMENDADO - MANTÉM HISTÓRICO)
--------------------------------------------------------------------------------

-- 1. Desativar perfis de terapeutas e usuários de demonstração
UPDATE public.profiles
SET active = false
WHERE full_name ILIKE '%Demo%'
   OR full_name ILIKE 'Ana Souza%'
   OR id IN (
     'c1000000-0000-0000-0000-000000000002', -- Ana Souza (seed original)
     'c1000000-0000-0000-0000-000000000003'  -- Bruno Lima (seed original se for fictício)
   );

-- 2. Marcar pacientes de teste/demo como inativos ou arquivados
UPDATE public.patients
SET status = 'inativo'
WHERE name ILIKE '%Demo%'
   OR name ILIKE '%Teste%'
   OR name ILIKE '%Ficticio%';


--------------------------------------------------------------------------------
-- OPÇÃO B: EXCLUSÃO DE DADOS FICTÍCIOS DE TESTE (USAR COM CAUTELA NO SQL EDITOR)
--------------------------------------------------------------------------------
/*
-- Descomente as linhas abaixo se desejar EXCLUIR permanentemente registros de teste:

-- 1. Apagar registros de agendamentos de teste
DELETE FROM public.appointments
WHERE notes ILIKE '%demo%' OR notes ILIKE '%teste%';

-- 2. Apagar pacientes de teste (garantindo exclusão em cascata ou limpos antes)
DELETE FROM public.patients
WHERE name ILIKE '%Demo%' OR name ILIKE '%Teste%';

-- 3. Apagar perfis demo específicos
DELETE FROM public.profiles
WHERE full_name ILIKE '%Demo%';
*/
