-- CPF passa a ser o identificador de login da equipe: e-mail nem sempre
-- existe na prática para recepção/terapeuta (mesmo problema que o Portal da
-- Família já resolvia com telefone+OTP em vez de e-mail). `profiles.email`
-- continua sendo o endereço real do Supabase Auth (auth.users.email) — só que
-- agora pode ser sintético quando o colaborador não tem e-mail próprio — e o
-- CPF é a chave pública que resolve pra esse endereço no login (ver
-- app/login/actions.ts). A coluna já existe na prática (usada pelo sync do
-- Grupo IB); esta migration só garante o índice único que faltava.

alter table public.profiles
  add column if not exists cpf text;

create unique index if not exists profiles_cpf_unique
  on public.profiles (cpf)
  where cpf is not null;
