-- =====================================================================
-- Substitui o N+1 de `session_note_pending(p_appointment_id)` chamado em
-- loop (uma RPC por sessão candidata) por duas funções que resolvem a
-- mesma regra de negócio ("sessão `realizada` há mais de N horas sem
-- `session_notes`") em uma única query agregada.
--
-- Mantém o mesmo guard de `current_clinic_id()` do `session_note_pending`
-- original (ver 20260904000015_profiles_admin_and_scope_fixes.sql) via
-- SECURITY DEFINER, para não depender da RLS de leitura de `session_notes`
-- (que restringe a gestor/supervisor/terapeuta dono) — chamadores como a
-- recepção precisam do mesmo resultado agregado que gestor/supervisão.
--
-- `session_note_pending` é mantida (ainda pode ter outros usos pontuais),
-- só deixa de ser chamada em loop pelo código em `lib/session-note-pending.ts`.
-- =====================================================================

create or replace function count_overdue_session_notes(p_hours_threshold integer default 24)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from appointments a
  join patients pt on pt.id = a.patient_id
  where a.status = 'realizada'
    and a.starts_at <= now() - (p_hours_threshold || ' hours')::interval
    and pt.clinic_id = current_clinic_id()
    and not exists (
      select 1 from session_notes sn where sn.appointment_id = a.id
    );
$$;

create or replace function list_overdue_session_notes(p_hours_threshold integer default 24)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  therapist_id uuid,
  therapist_name text,
  patient_name text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.starts_at, a.therapist_id, pr.full_name, pt.full_name
  from appointments a
  join patients pt on pt.id = a.patient_id
  left join profiles pr on pr.id = a.therapist_id
  where a.status = 'realizada'
    and a.starts_at <= now() - (p_hours_threshold || ' hours')::interval
    and pt.clinic_id = current_clinic_id()
    and not exists (
      select 1 from session_notes sn where sn.appointment_id = a.id
    )
  order by a.starts_at asc;
$$;

-- Checagem em lote de "nota pendente" para um conjunto arbitrário de
-- appointment_ids (usada pela home da recepção, que marca o ícone de
-- pendência nas sessões `realizada` do dia — sem o corte de horas das
-- funções acima). Substitui uma RPC `session_note_pending` por sessão do
-- dia por uma única chamada.
create or replace function session_notes_pending_status(p_appointment_ids uuid[])
returns table (appointment_id uuid, is_pending boolean)
language sql stable security definer set search_path = public as $$
  select a.id,
    (a.status = 'realizada' and not exists (
      select 1 from session_notes sn where sn.appointment_id = a.id
    ))
  from appointments a
  join patients pt on pt.id = a.patient_id
  where a.id = any(p_appointment_ids)
    and pt.clinic_id = current_clinic_id();
$$;
