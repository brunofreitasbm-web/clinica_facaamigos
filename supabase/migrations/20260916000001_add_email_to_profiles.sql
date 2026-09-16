-- Garantir que a coluna email existe na tabela public.profiles
alter table public.profiles
  add column if not exists email text;
