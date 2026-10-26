-- 20261026180000_staff_password_resets.sql
-- Tabela para armazenar códigos OTP de recuperação de senha e primeiro acesso da equipe/staff.

create table if not exists public.staff_password_resets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists staff_password_resets_email_idx
  on public.staff_password_resets (email, created_at desc);

create index if not exists staff_password_resets_profile_idx
  on public.staff_password_resets (profile_id, created_at desc);

alter table public.staff_password_resets enable row level security;
-- Sem políticas para anon/authenticated: acessado exclusivamente via service-role pelas server actions.
