-- supabase/migrations/20260916000000_therapist_unified_chart_access.sql
-- Garantir acesso ao Prontuário Unificado para qualquer paciente
-- atribuído na agenda do terapeuta ou atendido anteriormente por ele.

-- 1. Atualiza a função e trigger em appointments para disparar em INSERT e UPDATE OF therapist_id
create or replace function trg_grant_patient_access_on_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.therapist_id is not null and not exists (
    select 1 from patient_access
    where patient_id = new.patient_id
      and profile_id = new.therapist_id
      and access_type = 'terapeuta'
      and revoked_at is null
  ) then
    insert into patient_access (patient_id, profile_id, access_type, discipline)
    values (new.patient_id, new.therapist_id, 'terapeuta', new.discipline);
  end if;
  return new;
end;
$$;

drop trigger if exists grant_patient_access_on_appointment on appointments;
create trigger grant_patient_access_on_appointment
  after insert or update of therapist_id on appointments
  for each row execute function trg_grant_patient_access_on_appointment();

-- 2. Trigger em session_notes para garantir concessão quando nota de sessão é registrada/atualizada
create or replace function trg_grant_patient_access_on_session_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_patient_id uuid;
begin
  select patient_id into v_patient_id
  from appointments
  where id = new.appointment_id;

  if v_patient_id is not null then
    if new.therapist_id is not null and not exists (
      select 1 from patient_access
      where patient_id = v_patient_id
        and profile_id = new.therapist_id
        and access_type = 'terapeuta'
        and revoked_at is null
    ) then
      insert into patient_access (patient_id, profile_id, access_type)
      values (v_patient_id, new.therapist_id, 'terapeuta');
    end if;

    if new.author_id is not null and new.author_id <> new.therapist_id and not exists (
      select 1 from patient_access
      where patient_id = v_patient_id
        and profile_id = new.author_id
        and access_type = 'terapeuta'
        and revoked_at is null
    ) then
      insert into patient_access (patient_id, profile_id, access_type)
      values (v_patient_id, new.author_id, 'terapeuta');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists grant_patient_access_on_session_note on session_notes;
create trigger grant_patient_access_on_session_note
  after insert or update of therapist_id, author_id on session_notes
  for each row execute function trg_grant_patient_access_on_session_note();

-- 3. Reforça a função RLS has_patient_access para considerar atribuição em appointments e atendimentos em session_notes
create or replace function has_patient_access(p_patient_id uuid, p_types text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from patient_access pa
    where pa.patient_id = p_patient_id
      and pa.profile_id = auth.uid()
      and pa.access_type = any(p_types)
      and pa.revoked_at is null
  )
  or (
    'terapeuta' = any(p_types) and (
      exists (
        select 1 from appointments a
        where a.patient_id = p_patient_id
          and a.therapist_id = auth.uid()
      )
      or exists (
        select 1 from session_notes sn
        join appointments a on a.id = sn.appointment_id
        where a.patient_id = p_patient_id
          and (sn.therapist_id = auth.uid() or sn.author_id = auth.uid())
      )
    )
  );
$$;

-- 4. Backfill para agendamentos e notas de sessão legadas
insert into patient_access (patient_id, profile_id, access_type, discipline)
select distinct a.patient_id, a.therapist_id, 'terapeuta', a.discipline
from appointments a
where a.therapist_id is not null
  and not exists (
    select 1 from patient_access pa
    where pa.patient_id = a.patient_id
      and pa.profile_id = a.therapist_id
      and pa.access_type = 'terapeuta'
      and pa.revoked_at is null
  )
on conflict do nothing;

insert into patient_access (patient_id, profile_id, access_type)
select distinct a.patient_id, sn.therapist_id, 'terapeuta'
from session_notes sn
join appointments a on a.id = sn.appointment_id
where sn.therapist_id is not null
  and not exists (
    select 1 from patient_access pa
    where pa.patient_id = a.patient_id
      and pa.profile_id = sn.therapist_id
      and pa.access_type = 'terapeuta'
      and pa.revoked_at is null
  )
on conflict do nothing;

revoke execute on function trg_grant_patient_access_on_appointment() from public, anon, authenticated;
revoke execute on function trg_grant_patient_access_on_session_note() from public, anon, authenticated;
