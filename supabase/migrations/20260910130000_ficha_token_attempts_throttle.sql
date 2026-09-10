-- `/ficha/[token]` (20260909140000) não tinha nenhuma defesa contra
-- varredura do token: só a entropia do token (48 hex) e a expiração de 30
-- dias. `resolveIntakeToken` é a única porta de entrada do fluxo (GET da
-- página e POST de `submitFicha` passam por ela), então o throttle durável
-- por IP entra ali, no mesmo desenho de `checkin_requests`
-- (20260908040000): uma tabela só para contar tentativas por ip_hash na
-- última hora, sem policy de anon/authenticated — só service-role grava e lê.
create table ficha_token_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index ficha_token_attempts_ip_idx on ficha_token_attempts (ip_hash, created_at desc);

-- Purga própria: nada além do throttle usa estas linhas, então não há razão
-- para acumular além da janela de contagem (1h) mais uma margem de folga.
create index ficha_token_attempts_created_idx on ficha_token_attempts (created_at);

alter table ficha_token_attempts enable row level security;
-- Sem policies: só a service-role (que ignora RLS) grava e conta aqui.

-- Nada aqui sobrevive à janela de contagem (1h) além de uma margem de
-- folga: mesmo padrão de minimização de `purge_checkin_request_pii`
-- (20260908040000), mas aqui é limpeza total da linha, não zerar campo,
-- porque a linha inteira não serve pra nada fora do throttle.
create function purge_ficha_token_attempts() returns void
language sql security definer set search_path = public as $$
  delete from ficha_token_attempts where created_at < now() - interval '2 hours';
$$;

revoke execute on function purge_ficha_token_attempts() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'purge_ficha_token_attempts_hourly',
    '5 * * * *',
    $job$select purge_ficha_token_attempts();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende purge_ficha_token_attempts() externamente. %', sqlerrm;
end;
$$;
