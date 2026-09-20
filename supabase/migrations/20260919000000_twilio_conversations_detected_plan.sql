-- supabase/migrations/20260919000000_twilio_conversations_detected_plan.sql
-- Plano/convênio que o chatbot identificou na conversa. Conversa de lead não
-- tem paciente (logo, nem patient_insurance), então a pílula do plano na
-- Central de Atendimento precisava de um lugar próprio para morar.
--
-- insurer_id -> convênio CADASTRADO que casou com o que a pessoa disse (dá nome
-- + badge_color oficiais). Plano que não existe em `insurers` não é gravado.
alter table twilio_conversations
  add column if not exists insurer_id uuid references insurers(id) on delete set null;
