-- supabase/migrations/20260916010000_intake_carteirinha_requirement.sql
-- Os dois chatbots de entrada (twilio-anamnesis-bot.ts e twilio-intake-bot.ts)
-- passam a exigir, além de Laudo e Guia/Autorização, a foto da carteirinha
-- do plano (frente e verso, ou um único PDF cobrindo as duas páginas).

-- 1. Fluxo direto (lib/twilio-anamnesis-bot.ts): colunas dedicadas na
-- requisição de agendamento, mesmo padrão de laudo_pdf_url/guia_pdf_url.
alter table anamnesis_scheduling_requests
  add column if not exists carteirinha_frente_url text,
  add column if not exists carteirinha_verso_url text;

-- 2. Fluxo de acolhimento oriundo de plano de saúde (lib/twilio-intake-bot.ts
-- + app/supervisao/acolhimento-lead-drawer.tsx): supervisor classifica cada
-- arquivo recebido por `kind`, que vira a `category` em `documents`
-- (app/supervisao/acolhimento-actions.ts) — precisa aceitar 'carteirinha'
-- pra mapear pra categoria 'carteirinha' (já usada pelo checklist de entrada
-- em lib/intake-checklist.ts).
alter table insurance_intake_lead_files drop constraint if exists insurance_intake_lead_files_kind_check;
alter table insurance_intake_lead_files add constraint insurance_intake_lead_files_kind_check
  check (kind in ('laudo', 'guia', 'carteirinha', 'outro') or kind is null);
