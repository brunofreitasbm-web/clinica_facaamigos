-- supabase/migrations/20260921020000_whatsapp_lead_documents.sql
-- Documentos que o responsável manda por WhatsApp (laudo, guia, carteirinha,
-- certidão...) passam a virar linhas de `documents` do paciente-lead
-- (status 'interessado') assim que chegam — é isso que faz a aba "Documentos"
-- do prontuário e o painel de leads da supervisão enxergarem os arquivos.
--
-- 1) `uploaded_by` deixa de ser obrigatório: quem "envia" é o chatbot, não um
--    profile. A origem passa a ser registrada em `source`.
-- 2) `original_name`/`mime_type` deixam a listagem mostrar o nome e o tipo
--    reais do arquivo (foto vs PDF).
-- 3) `source_key` (ex.: SID da mídia do Twilio) + índice único parcial:
--    reentrega do webhook nunca duplica o mesmo arquivo.
alter table documents alter column uploaded_by drop not null;

alter table documents
  add column if not exists original_name text,
  add column if not exists mime_type text,
  add column if not exists source text,
  add column if not exists source_key text;

create unique index if not exists documents_patient_source_key_uniq
  on documents (patient_id, source_key)
  where source_key is not null;

comment on column documents.source is 'Origem do arquivo: whatsapp | portal | upload (null = upload manual antigo).';
comment on column documents.source_key is 'Chave de idempotência da origem (ex.: URL/SID da mídia do Twilio).';
