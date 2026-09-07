-- 20260906000018_reception_audit_and_workflow.sql já redefiniu (create or
-- replace) trg_patient_lead_to_evaluation() e trg_patient_auto_activation(),
-- mas a migration que originalmente as ligava a um trigger em `appointments`
-- (20260906000018) nunca foi aplicada no projeto real — as funções existiam
-- soltas, sem nunca disparar. Esta migration corrige isso ligando os
-- triggers às funções já corretas.
--
-- Também corrige, na mesma função, o "furo" descrito em
-- lib/patient-stage.ts: check-out de uma sessão de AVALIAÇÃO não deve
-- promover o paciente direto pra 'ativo' (isso pula avaliado_at e a
-- autorização — ver markEvaluationDone em stage-actions.ts, que deixa
-- checkout_at nulo de propósito, mas o check-out genérico da agenda não).
-- Só sessão de tratamento real (is_evaluation = false) ativa o paciente.
create or replace function trg_patient_auto_activation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'realizada' and new.checkout_at is not null and not new.is_evaluation then
    update patients
    set status = 'ativo'
    where id = new.patient_id
      and status in ('interessado', 'avaliacao');
  end if;

  return new;
end;
$$;

drop trigger if exists patient_lead_to_evaluation on appointments;
create trigger patient_lead_to_evaluation
  after insert on appointments
  for each row execute function trg_patient_lead_to_evaluation();

drop trigger if exists patient_auto_activation on appointments;
create trigger patient_auto_activation
  after update on appointments
  for each row execute function trg_patient_auto_activation();

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

-- Advisor de segurança acusou trg_patient_lead_to_evaluation/
-- trg_patient_auto_activation como executáveis diretamente via RPC por
-- qualquer usuário autenticado (são SECURITY DEFINER só por serem trigger
-- functions, nunca deveriam ser chamadas fora do trigger).
revoke execute on function trg_patient_lead_to_evaluation() from public, anon, authenticated;
revoke execute on function trg_patient_auto_activation() from public, anon, authenticated;
revoke execute on function log_patient_access(uuid, text) from public, anon, authenticated;
grant execute on function log_patient_access(uuid, text) to authenticated;
