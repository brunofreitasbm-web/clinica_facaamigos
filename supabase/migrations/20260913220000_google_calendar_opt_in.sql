-- supabase/migrations/20260913220000_google_calendar_opt_in.sql
-- Opt-in por pessoa para receber convites de agenda do Google Calendar a
-- cada atendimento (terapeuta e/ou responsável). Não é automático mesmo
-- com e-mail Gmail cadastrado: são dados de agenda de saúde envolvendo
-- menores, então a sincronização exige consentimento explícito.
alter table profiles add column google_calendar_opt_in boolean not null default false;
alter table guardians add column google_calendar_opt_in boolean not null default false;
