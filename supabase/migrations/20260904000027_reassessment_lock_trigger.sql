-- supabase/migrations/20260904000027_reassessment_lock_trigger.sql
-- Trava de Reavaliação Pendente (§9.8 / PRD §8 Fase 2):
-- Impede criação de nova autorização (guia) se o paciente possuir um alerta de
-- reavaliação pendente há mais de 30 dias sem relatório de reavaliação assinado.

create or replace function fn_check_reassessment_lock()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_patient_id uuid;
  v_overdue_count integer;
begin
  -- Descobre o paciente associado à carteirinha de convênio
  select patient_id into v_patient_id
  from patient_insurance
  where id = new.patient_insurance_id;

  if v_patient_id is null then
    return new;
  end if;

  -- Checa se existe alerta de reavaliação notificado com mais de 30 dias sem relatório
  select count(*) into v_overdue_count
  from reassessment_alerts
  where patient_id = v_patient_id
    and status = 'notificado'
    and created_at < now() - interval '30 days';

  if v_overdue_count > 0 then
    raise exception 'Bloqueio de Autorização: Paciente possui relatório de reavaliação pendente há mais de 30 dias. Emitir relatório no painel de supervisão antes de cadastrar nova guia.';
  end if;

  return new;
end;
$$;

create trigger trg_check_reassessment_lock
  before insert on authorizations
  for each row execute function fn_check_reassessment_lock();
