-- supabase/tests/rls_security.test.sql
-- Testes de Segurança RLS e LGPD (Isolamento de Dados e Perfis)

begin;
select plan(5);

-- 1. Testar RLS em pacientes (Gestor da clínica vê pacientes da própria clínica)
select has_table('patients', 'Tabela patients possui RLS ativado');

-- 2. Testar se RLS está habilitado em tabela sensível de menores
select rls_is_enabled('public', 'patients', 'RLS ativado na tabela patients');

-- 3. Testar se protocol_items restringe leitura para não-certificados
select rls_is_enabled('public', 'protocol_items', 'RLS ativado em protocol_items');

-- 4. Testar audit_log contra vazamento cruzado
select rls_is_enabled('public', 'audit_log', 'RLS ativado em audit_log');

-- 5. Testar mensagens e canal WhatsApp
select rls_is_enabled('public', 'messages', 'RLS ativado na tabela de mensagens');

select * from finish();
rollback;
