-- supabase/migrations/20260914040000_documents_tcle_category.sql
-- Categoria nova para permitir que o TCLE (hoje só impresso, lib/tcle.ts)
-- também exista como registro em `documents` e passe pelo fluxo de
-- assinatura eletrônica em /assinar/[documentId] (junto com termo_lgpd e
-- termo_imagem, as outras duas categorias liberadas nesse fluxo).
--
-- Esta migration também restaura 'contrato', 'termo_lgpd', 'termo_imagem',
-- 'documento_responsavel', 'kit_boas_vindas', 'carta_terapeuta',
-- 'manual_clinica', 'familia_envio', 'certidao_nascimento',
-- 'documento_identidade', 'comprovante_residencia' e
-- 'compartilhamento_familia': 20260913040000_at_therapeutic_followup.sql
-- recriou o constraint com uma lista antiga (sem essas categorias, todas já
-- existentes antes dela) ao adicionar 'relatorio_at_escola' — sem esta
-- correção, o insert de qualquer uma delas passaria a falhar.
alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check check (category in (
  'pedido_medico', 'laudo', 'carteirinha', 'termo', 'relatorio_evolucao', 'reavaliacao',
  'autorizacao', 'outro',
  'contrato', 'termo_lgpd', 'termo_imagem', 'documento_responsavel',
  'kit_boas_vindas', 'carta_terapeuta', 'manual_clinica',
  'familia_envio',
  'certidao_nascimento', 'documento_identidade', 'comprovante_residencia',
  'compartilhamento_familia',
  'relatorio_at_escola',
  'tcle'
));
