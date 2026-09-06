-- supabase/migrations/20260906000022_appointments_checkin_guard.sql
--
-- Gap identificado em auditoria contra o brief "human_failure_shield": nada
-- impedia uma sessão de ser marcada como `status='realizada'` sem `checkin_at`
-- preenchido (a recepção nunca registrou a chegada do paciente). Verificado
-- ao vivo em transação com ROLLBACK no projeto real: INSERT com
-- status='realizada', checkin_at=null, is_provisional=true foi aceito.
--
-- Segue o mesmo padrão de guard de transição usado em
-- appointments_authorization_guard (20260904000006b): só valida quando a
-- linha está *entrando* em status='realizada' (INSERT direto nesse status, ou
-- UPDATE vindo de um status diferente), para não re-bloquear updates
-- subsequentes numa sessão já realizada (ex.: editar checkout_at depois).
create or replace function appointments_checkin_guard() returns trigger
language plpgsql as $$
begin
  if new.status = 'realizada'
     and (TG_OP = 'INSERT' or old.status <> 'realizada')
     and new.checkin_at is null then
    raise exception 'sessão realizada exige checkin_at (chegada do paciente não registrada)';
  end if;
  return new;
end;
$$;

create trigger trg_appointments_checkin_guard
  before insert or update on appointments
  for each row execute function appointments_checkin_guard();
