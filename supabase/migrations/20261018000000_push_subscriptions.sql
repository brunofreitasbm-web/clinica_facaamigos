-- Web Push do PWA de Atendimento (/m/atendimento): uma linha por aparelho
-- inscrito. Quem ENVIA o push é o servidor (service role); o usuário só
-- gerencia as próprias inscrições.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy push_subscriptions_select_own on push_subscriptions
  for select using (user_id = auth.uid());
create policy push_subscriptions_insert_own on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy push_subscriptions_delete_own on push_subscriptions
  for delete using (user_id = auth.uid());

-- Debounce: no máximo 1 push por conversa a cada poucos minutos. A reserva é
-- um UPDATE condicional (atômico), então duas mensagens simultâneas não
-- disparam dois avisos.
alter table twilio_conversations add column if not exists last_push_at timestamptz;
