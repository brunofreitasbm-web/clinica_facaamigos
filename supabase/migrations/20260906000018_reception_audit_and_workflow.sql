-- Migration: 20260906000018_reception_audit_and_workflow.sql
-- Automações de status do paciente na recepção + Suporte a Auditoria LGPD de Acesso de Prontuário

-- 1. Função e Trigger: Promover Lead -> Avaliação no primeiro agendamento
create or replace function trg_patient_lead_to_evaluation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Se o paciente estiver no status 'lead', ao agendar a primeira sessão (avaliação ou triagem), transiciona para 'avaliacao'
  update patients
  set status = 'avaliacao'
  where id = new.patient_id
    and status = 'lead';

  return new;
end;
$$;

drop trigger if exists patient_lead_to_evaluation on appointments;
create trigger patient_lead_to_evaluation
  after insert on appointments
  for each row execute function trg_patient_lead_to_evaluation();

-- 2. Função e Trigger: Ativação automática de Paciente no 1º Check-out (Sessão Realizada)
create or replace function trg_patient_auto_activation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Quando a sessão é concluída ('realizada' com checkout_at preenchido), se o paciente for 'lead' ou 'avaliacao', vira 'ativo'
  if new.status = 'realizada' and new.checkout_at is not null then
    update patients
    set status = 'ativo'
    where id = new.patient_id
      and status in ('lead', 'avaliacao');
  end if;

  return new;
end;
$$;

drop trigger if exists patient_auto_activation on appointments;
create trigger patient_auto_activation
  after update on appointments
  for each row execute function trg_patient_auto_activation();

-- 3. RPC para registro de acesso a prontuário / documentos (LGPD Compliance)
create or replace function log_patient_access(p_patient_id uuid, p_reason text default 'Visualização de ficha/prontuário na recepção') returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  insert into record_access_log (patient_id, accessed_by, reason)
  values (p_patient_id, v_user_id, p_reason);
end;
$$;
