-- Agente de leitura de laudo (agenda de supervisão 13/09/2026): quando o
-- laudo chega pelo WhatsApp do bot de acolhimento (lib/twilio-intake-bot.ts),
-- a IA já lê o arquivo e extrai número do laudo, validade, CID, exceções e
-- quantidades de sessão, além de um resumo em texto livre — o laudo médico
-- não tem formato padronizado entre convênios/profissionais, então o
-- supervisor precisa desse resumo pra validar rápido, sem abrir o PDF toda
-- vez. Ver lib/laudo-extraction.ts.
alter table insurance_intake_lead_files
  add column extraction jsonb,
  add column extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'done', 'failed')),
  add column extracted_at timestamptz;

comment on column insurance_intake_lead_files.extraction is
  'Saída estruturada de extractLaudoDocument (lib/laudo-extraction.ts): report_number, report_date, valid_until, cid, diagnosis_summary, professional_name, professional_register, recommended_frequency, recommended_quantity_sessions, exceptions[], summary, confidence, warnings. Null enquanto extraction_status=pending.';
