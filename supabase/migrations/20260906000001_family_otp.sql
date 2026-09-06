-- Migração para suporte a Login OTP da Família via Telefone (Sem Twilio)

create table if not exists family_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists family_otp_codes_phone_idx on family_otp_codes(phone, created_at desc);

alter table family_otp_codes enable row level security;

-- Política de RLS: apenas a service-role (admin client) acessa os códigos de OTP diretamente.
-- Nenhum acesso público direto via API do Supabase client-side.
