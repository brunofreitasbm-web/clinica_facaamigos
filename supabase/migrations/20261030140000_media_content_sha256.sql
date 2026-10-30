-- Detecção de arquivo duplicado por CONTEÚDO (sha256 dos bytes originais).
-- O WhatsApp gera uma MediaUrl nova a cada envio, então o mesmo arquivo mandado
-- duas vezes escapava dos índices por URL (documents.source_key,
-- *_twilio_media_url). Índices NÃO únicos: linhas antigas ficam sem hash e a
-- decisão de ignorar o reenvio é do código (lib/whatsapp-media-pure.ts).

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_sha256 text;
ALTER TABLE public.registration_draft_files
  ADD COLUMN IF NOT EXISTS content_sha256 text;
ALTER TABLE public.insurance_intake_lead_files
  ADD COLUMN IF NOT EXISTS content_sha256 text;

CREATE INDEX IF NOT EXISTS idx_documents_patient_content_sha256
  ON public.documents (patient_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registration_draft_files_draft_content_sha256
  ON public.registration_draft_files (draft_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insurance_intake_lead_files_lead_content_sha256
  ON public.insurance_intake_lead_files (lead_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;
