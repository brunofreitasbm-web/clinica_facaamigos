-- supabase/migrations/20260904000006b_appointments_guard_fix.sql
--
-- FIX (Critical, encontrado em review pós-Task 6): a condição de entrada do guard
-- introduzida em 20260904000006 — `TG_OP = 'INSERT' or old.status <> 'realizada'` —
-- pulava o bloco inteiro (validação + incremento) quando uma sessão reconciliada de
-- is_provisional=true para is_provisional=false mantinha status='realizada' durante
-- o UPDATE (old.status = new.status = 'realizada'). Isso permitia que uma sessão
-- provisória fosse "oficializada" sem nunca validar authorization_id/vigência/
-- sessões restantes e sem nunca incrementar sessions_used — bypass permanente da
-- exigência de guia vigente (pior que o falso-positivo que a correção anterior
-- resolveu).
--
-- Correção: a condição de transição agora também considera mudança de
-- is_provisional. O guard roda sempre que a linha entra em ('realizada', não
-- provisional) vindo de um estado que não era exatamente isso — seja por status
-- diferente, seja por is_provisional diferente.
create or replace function appointments_authorization_guard() returns trigger
language plpgsql as $$
declare
  auth_row authorizations%rowtype;
begin
  if new.status = 'realizada' and new.is_provisional = false
     and (
       TG_OP = 'INSERT'
       or old.status <> 'realizada'
       or old.is_provisional <> new.is_provisional
     ) then
    if new.authorization_id is null then
      raise exception 'sessão realizada exige authorization_id (a menos que is_provisional)';
    end if;
    select * into auth_row from authorizations where id = new.authorization_id for update;
    if auth_row.status <> 'ativa' then
      raise exception 'autorização % não está ativa (status=%)', new.authorization_id, auth_row.status;
    end if;
    if new.starts_at::date < auth_row.valid_from or new.starts_at::date > auth_row.valid_to then
      raise exception 'sessão fora da vigência da autorização %', new.authorization_id;
    end if;
    if auth_row.sessions_used >= auth_row.sessions_authorized then
      raise exception 'autorização % sem sessões restantes', new.authorization_id;
    end if;
    update authorizations set sessions_used = sessions_used + 1 where id = new.authorization_id;
  end if;
  return new;
end;
$$;
