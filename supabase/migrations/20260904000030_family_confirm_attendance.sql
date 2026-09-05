-- supabase/migrations/20260904000030_family_confirm_attendance.sql
--
-- §9.7 do PRD: "Agenda do filho... confirmar/justificar falta." A justificativa
-- de falta já existia (absence_reports); confirmar presença nunca foi
-- implementado — a tela do portal tinha um botão desabilitado ("Em breve").
--
-- Não dá pra resolver isso com uma policy de UPDATE comum em `appointments`
-- pra responsavel: RLS não restringe QUAIS colunas são alteradas, só QUAIS
-- linhas — uma policy aberta deixaria a família alterar qualquer campo da
-- sessão (terapeuta, sala, horário), não só a confirmação. Uma função
-- security definer que só altera os 3 campos de confirmação, com guarda
-- explícita de acesso e de status, é o mesmo padrão já usado em
-- close_monthly_metric_snapshots/refresh_reassessment_alerts (definer
-- restrito), só que aqui exposta de propósito via RPC pro app chamar.
create function confirm_attendance(p_appointment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  appt appointments%rowtype;
begin
  select * into appt from appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Sessão não encontrada.';
  end if;

  if not has_patient_access(appt.patient_id, array['responsavel']) then
    raise exception 'Sem permissão para confirmar esta sessão.';
  end if;

  if appt.status <> 'agendada' then
    raise exception 'Esta sessão não está aguardando confirmação.';
  end if;

  update appointments
  set status = 'confirmada', confirmed_at = now(), confirmed_via = 'portal'
  where id = p_appointment_id;
end;
$$;

-- Só `authenticated` (a própria RLS interna via has_patient_access decide
-- quem de fato consegue confirmar) — nunca `anon`, mesmo cuidado do linter
-- de segurança aplicado em 20260904000028.
revoke execute on function confirm_attendance(uuid) from public, anon;
grant execute on function confirm_attendance(uuid) to authenticated;
