-- supabase/migrations/20260906000020_family_document_upload.sql
-- PRD §9.7/§3.6: envio de documentos pela família (carteirinha atualizada,
-- pedido médico novo, comprovante de residência). `documents_write`
-- (20260904000008) só aceita insert de recepcao/supervisor/gestor/terapeuta
-- — o responsável não podia enviar nada. Categoria nova e isolada
-- ('familia_envio') em vez de reaproveitar 'documento_responsavel' (que é do
-- fluxo de Acolhimento feito pela recepção, 20260906000006): manter os dois
-- canais de origem separados evita que um documento enviado pela família
-- pareça já ter sido conferido pela recepção.
alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check check (category in (
  'pedido_medico', 'laudo', 'carteirinha', 'termo', 'relatorio_evolucao', 'reavaliacao',
  'autorizacao', 'outro',
  'contrato', 'termo_lgpd', 'termo_imagem', 'documento_responsavel',
  'kit_boas_vindas', 'carta_terapeuta', 'manual_clinica',
  'familia_envio'
));

-- `note`: rótulo livre que a família dá ao arquivo (documents não tinha
-- nenhum campo de descrição — só category, que aqui é sempre 'familia_envio').
-- `reviewed_at`/`reviewed_by`: pendência da recepção (lib/reception-queue.ts)
-- fica aberta enquanto reviewed_at is null; documents_update (20260904000014)
-- já permite recepcao/supervisor/gestor darem update em qualquer documento da
-- clínica, então nenhuma policy nova é necessária pra marcar como revisado.
alter table documents add column note text;
alter table documents add column reviewed_at timestamptz;
alter table documents add column reviewed_by uuid references profiles(id);

-- Responsável só insere na categoria 'familia_envio', nunca compartilhado
-- (shared_with_family=false — quem decide reexibir pra família é a
-- recepção/terapeuta editando depois, não o próprio upload) e só pro
-- paciente ao qual tem acesso.
create policy documents_write_family on documents for insert
  with check (
    category = 'familia_envio'
    and shared_with_family = false
    and uploaded_by = auth.uid()
    and has_patient_access(patient_id, array['responsavel'])
  );

-- documents_read (20260904000008) só libera pro responsável linhas com
-- shared_with_family=true — um envio próprio ainda não revisado não teria
-- essa flag, então sem esta policy adicional a família não veria nem o
-- status do que ela mesma mandou.
create policy documents_read_own_family_upload on documents for select
  using (
    category = 'familia_envio'
    and uploaded_by = auth.uid()
    and has_patient_access(patient_id, array['responsavel'])
  );
