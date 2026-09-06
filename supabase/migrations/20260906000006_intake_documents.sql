-- supabase/migrations/20260906000006_intake_documents.sql
-- Módulo 3 MAAIS, slide 4 fluxo Acolhimento (pedido médico c/ CID,
-- carteirinha, documento do responsável, termo LGPD, termo de imagem,
-- contrato particular) e slide 19 (kit de boas-vindas, carta ao terapeuta,
-- manual da clínica). documents.category só cobria os documentos clínicos
-- (laudo, autorização etc.), não os de entrada nem os institucionais.

alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check check (category in (
  'pedido_medico', 'laudo', 'carteirinha', 'termo', 'relatorio_evolucao', 'reavaliacao',
  'autorizacao', 'outro',
  'contrato', 'termo_lgpd', 'termo_imagem', 'documento_responsavel',
  'kit_boas_vindas', 'carta_terapeuta', 'manual_clinica'
));

-- Upload de um contrato (categoria 'contrato') conclui a etapa de assinatura
-- do checklist de entrada — dispensa um botão manual separado.
create function trg_documents_intake_sync() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if new.category = 'contrato' then
    perform set_intake_step_complete(new.patient_id, 'contrato_assinado', new.uploaded_by);
    update patients set contract_signed_at = coalesce(contract_signed_at, new.uploaded_at) where id = new.patient_id;
  end if;
  return new;
end;
$f$;

create trigger documents_intake_sync
  after insert on documents
  for each row execute function trg_documents_intake_sync();
