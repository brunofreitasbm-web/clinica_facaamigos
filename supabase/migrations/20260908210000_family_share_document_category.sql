-- supabase/migrations/20260908210000_family_share_document_category.sql
-- PDF consolidado de compartilhamento com a família (Prontuário Unificado,
-- ação restrita a supervisor/gestor — checada na Server Action, mesmo padrão
-- de treatment_plans_write_supervisor em 20260908183000). Categoria nova e
-- isolada em vez de reaproveitar 'relatorio_evolucao' (que é o relatório
-- técnico pro convênio, §8 Fase 2, nunca pensado pra ir direto à família).
-- documents_write (20260904000008) já libera insert de supervisor/gestor,
-- então nenhuma policy nova é necessária aqui.
alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check check (category in (
  'pedido_medico', 'laudo', 'carteirinha', 'termo', 'relatorio_evolucao', 'reavaliacao',
  'autorizacao', 'outro',
  'contrato', 'termo_lgpd', 'termo_imagem', 'documento_responsavel',
  'kit_boas_vindas', 'carta_terapeuta', 'manual_clinica',
  'familia_envio',
  'certidao_nascimento', 'documento_identidade', 'comprovante_residencia',
  'compartilhamento_familia'
));
