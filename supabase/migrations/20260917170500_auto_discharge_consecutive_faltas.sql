-- supabase/migrations/20260917170500_auto_discharge_consecutive_faltas.sql
-- "Regra de faltas: 2 faltas não justificadas = desligamento automático da
-- agenda, sem aviso prévio." Diferente de absence_alerts (20260906000015,
-- que só ALERTA a partir de 3 faltas consecutivas ou 50% em 3 meses), esta
-- migration efetivamente cancela a grade futura e move o paciente para
-- 'evadido' assim que a 2ª falta consecutiva sem justificativa aprovada é
-- registrada — manual (markMissedOrCancelled) ou automática
-- (auto_resolve_appointments, 20260906000016).
alter table patients
  add column if not exists discharged_at timestamptz,
  add column if not exists discharge_reason text,
  add column if not exists discharged_auto boolean not null default false;

create table patient_discharge_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  kind text not null check (kind in ('auto_desligamento','reativacao')),
  trigger_appointment_id uuid references appointments(id),
  cancelled_appointment_ids uuid[] not null default '{}',
  previous_status text,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table patient_discharge_events enable row level security;

create policy patient_discharge_events_read on patient_discharge_events for select
  using (
    exists (select 1 from patients pt where pt.id = patient_discharge_events.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy patient_discharge_events_write on patient_discharge_events for insert
  with check (
    exists (select 1 from patients pt where pt.id = patient_discharge_events.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

-- Igual a patient_absence_stats (20260906000015), mas ignora faltas com
-- absence_reports.status='aprovado' (justificadas não contam para o
-- desligamento) — "consecutivas" aqui é o critério confirmado pelo usuário
-- (não é % nem acumulado desde a entrada).
create function unjustified_consecutive_faltas(p_patient_id uuid) returns int
language plpgsql stable as $$
declare
  r record;
  v_consecutive int := 0;
  v_counting boolean := true;
begin
  for r in
    select a.id, a.status
    from appointments a
    where a.patient_id = p_patient_id
      and a.status in ('realizada','falta_familia')
    order by a.starts_at desc
  loop
    if not v_counting then
      exit;
    end if;
    if r.status = 'falta_familia' then
      if exists (select 1 from absence_reports ar where ar.appointment_id = r.id and ar.status = 'aprovado') then
        v_counting := false;
      else
        v_consecutive := v_consecutive + 1;
      end if;
    else
      v_counting := false;
    end if;
  end loop;

  return v_consecutive;
end;
$$;

-- Desligamento efetivo: cancela a grade futura e move o paciente para
-- 'evadido'. Sem aviso à família (decisão do usuário) — por isso não insere
-- em `messages`, diferente de refresh_absence_alerts.
create function apply_auto_discharge(p_patient_id uuid, p_trigger_appointment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_cancelled_ids uuid[];
begin
  select status into v_status from patients where id = p_patient_id;
  if v_status is distinct from 'ativo' then
    return;
  end if;

  if unjustified_consecutive_faltas(p_patient_id) < 2 then
    return;
  end if;

  select coalesce(array_agg(id), '{}') into v_cancelled_ids
  from appointments
  where patient_id = p_patient_id
    and starts_at > now()
    and status in ('agendada','confirmada');

  update appointments
  set status = 'cancelada_clinica',
      cancel_reason = 'desligamento_automatico_2_faltas',
      cancelled_at = now(),
      auto_marked = true
  where id = any(v_cancelled_ids);

  update patients
  set status = 'evadido',
      discharged_at = now(),
      discharge_reason = '2 faltas consecutivas sem justificativa',
      discharged_auto = true
  where id = p_patient_id;

  insert into patient_discharge_events (patient_id, kind, trigger_appointment_id, cancelled_appointment_ids, previous_status, reason)
  values (p_patient_id, 'auto_desligamento', p_trigger_appointment_id, v_cancelled_ids, v_status, '2 faltas consecutivas sem justificativa');

  insert into audit_log (table_name, row_id, action, actor_id, clinic_id, after)
  select 'patients', p_patient_id, 'patient_auto_discharged', null, pt.clinic_id,
    jsonb_build_object('trigger_appointment_id', p_trigger_appointment_id, 'cancelled_count', array_length(v_cancelled_ids, 1))
  from patients pt where pt.id = p_patient_id;
end;
$$;

revoke execute on function apply_auto_discharge(uuid, uuid) from public, anon, authenticated;

-- Cobre tanto o cancelamento manual (markMissedOrCancelled) quanto o
-- automático (auto_resolve_appointments) — os dois fazem UPDATE de status
-- em appointments. Envolvido em exception handler para não derrubar o lote
-- do cron caso algo dê errado (mesma postura de appointments_avulsa_charge).
create function trg_appointments_auto_discharge() returns trigger
language plpgsql as $$
begin
  if new.status = 'falta_familia' and (old.status is distinct from new.status) then
    begin
      perform apply_auto_discharge(new.patient_id, new.id);
    exception when others then
      raise warning 'apply_auto_discharge falhou para paciente %: %', new.patient_id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create trigger trg_appointments_auto_discharge
  after update of status on appointments
  for each row execute function trg_appointments_auto_discharge();

-- Reativação manual (recepção/supervisão/gestor) — não recria sessões, a
-- grade é regenerada depois via lib/grade-recurrence.ts.
create function reactivate_discharged_patient(p_patient_id uuid, p_by uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update patients
  set status = 'ativo',
      discharged_at = null,
      discharge_reason = null,
      discharged_auto = false
  where id = p_patient_id;

  insert into patient_discharge_events (patient_id, kind, previous_status, reason, created_by)
  values (p_patient_id, 'reativacao', 'evadido', 'Reativado manualmente após desligamento automático', p_by);

  insert into audit_log (table_name, row_id, action, actor_id, clinic_id)
  select 'patients', p_patient_id, 'patient_reactivated', p_by, pt.clinic_id
  from patients pt where pt.id = p_patient_id;
end;
$$;

revoke execute on function reactivate_discharged_patient(uuid, uuid) from public, anon, authenticated;
grant execute on function reactivate_discharged_patient(uuid, uuid) to authenticated;
