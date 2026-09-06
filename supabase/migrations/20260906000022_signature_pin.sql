-- supabase/migrations/20260906000022_signature_pin.sql
-- PRD §9.4: "Assinatura Digital: Confirmação com PIN do terapeuta → gera
-- signed_at". Até agora signed_at era gravado sem nenhuma confirmação de
-- identidade além da sessão logada. O hash é gerado/verificado em Node
-- (lib/signature-pin.ts, scrypt) — aqui só guardamos o hash e o estado de
-- tentativas, nunca o PIN em texto puro.
alter table profiles
  add column signature_pin_hash text,
  add column signature_pin_updated_at timestamptz,
  add column signature_pin_failed_attempts int not null default 0,
  add column signature_pin_locked_until timestamptz;
