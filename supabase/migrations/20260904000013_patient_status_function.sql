-- Task 13: patient_status_as_of
-- Retorna o status de um paciente em um instante passado, reconstruindo a
-- partir de audit_log (Task 12) quando disponível, ou o status atual caso
-- não haja histórico anterior ao instante pedido.

create function patient_status_as_of(p_patient_id uuid, p_at timestamptz) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_clinic_id uuid;
  v_status text;
begin
  select clinic_id into v_clinic_id from patients where id = p_patient_id;
  if v_clinic_id is null then
    raise exception 'paciente não encontrado';
  end if;
  if v_clinic_id <> current_clinic_id() then
    raise exception 'acesso negado';
  end if;
  if app_current_role() not in ('gestor','supervisor') and not has_patient_access(p_patient_id, array['terapeuta','responsavel']) then
    raise exception 'acesso negado';
  end if;

  select (after->>'status') into v_status
  from audit_log
  where table_name = 'patients' and row_id = p_patient_id and at <= p_at
  order by at desc
  limit 1;

  if v_status is null then
    select status into v_status from patients where id = p_patient_id;
  end if;

  return v_status;
end;
$$;
