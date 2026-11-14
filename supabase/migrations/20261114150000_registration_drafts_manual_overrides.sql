-- "Ajustar cadastro > Corrigir dados": as correções do operador precisam sobreviver à releitura dos documentos.
-- Quando a família manda um arquivo novo, registration_drafts.extracted é zerado e a IA lê tudo de novo
-- (lib/registration-drafts-ingest.ts, lib/registration-drafts-process.ts), o que apagava o que o operador corrigiu.
-- As correções ficam nesta coluna, que nada disso mexe, e são reaplicadas por cima de cada leitura nova
-- (lib/draft-adjust-pure.ts: computeManualOverrides / applyManualOverrides).
--
-- Formato: {"patient": {"full_name": "...", "cpf": null}, "guardian": {...}, "insurance": {"card_number": "..."}}.
-- Valor null = o operador apagou um dado errado. Só a equipe lê; nada daqui é enviado à família.
-- Seguro de aplicar: coluna nova, opcional, sem default; o código funciona sem ela (só não guarda as correções).

alter table registration_drafts add column if not exists manual_overrides jsonb;

comment on column registration_drafts.manual_overrides is
  'Correções feitas pela recepção em "Ajustar cadastro", reaplicadas por cima de cada releitura dos documentos (patient/guardian/insurance).';
