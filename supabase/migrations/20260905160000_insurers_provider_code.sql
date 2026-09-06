-- supabase/migrations/20260905160000_insurers_provider_code.sql
--
-- app/faturamento/guias (geração de lote XML TISS) hoje usa um
-- `codigoPrestador` hardcoded no client — a página inteira é mock. Pra
-- gerar XML de verdade é preciso o código do prestador NA operadora (número
-- de credenciamento, diferente por convênio), que não existia em lugar
-- nenhum do schema. Adiciona a coluna em `insurers` (cadastrado uma vez por
-- convênio em /gestor/convenios, junto do ans_code) em vez de inventar um
-- valor no XML gerado.
alter table insurers add column provider_code text;
