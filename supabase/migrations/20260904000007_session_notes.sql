-- supabase/migrations/20260904000007_session_notes.sql
create table session_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  therapist_id uuid not null references profiles(id),
  version int not null default 1,
  supersedes_id uuid references session_notes(id),
  structured jsonb not null default '{}'::jsonb,
  free_text text,
  created_at_device timestamptz not null,
  created_at_server timestamptz not null default now(),
  signed_at timestamptz
);

create table trial_data (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  program_id uuid not null references programs(id),
  trial_index int not null,
  result text not null check (result in ('correto','incorreto','ajuda','nao_aplicado')),
  prompt_level text,
  duration_s numeric(6,2),
  recorded_at timestamptz not null default now()
);

alter table session_notes enable row level security;
alter table trial_data enable row level security;

-- append-only: sem policy de update/delete para nenhum papel — só select e insert existem abaixo.

-- FIX: adicionado join até patients.clinic_id via appointments para escopar gestores/supervisores
-- por clínica. Sem isso, um supervisor de clinic A poderia ler notas de ANY therapist, mesmo que
-- em clinic B. Mesmo padrão aplicado em Tasks 4-6.
create policy session_notes_read on session_notes for select
  using (
    exists (select 1 from appointments a
           join patients p on p.id = a.patient_id
           where a.id = session_notes.appointment_id
           and p.clinic_id = current_clinic_id()
           and (
             app_current_role() in ('gestor','supervisor')
             or a.therapist_id = auth.uid()
           ))
  );

-- FIX: adicionado join até patients.clinic_id via appointments. Sem isso, supervisor de clinic A
-- poderia inserir notas em qualquer appointment, mesmo de clinic B.
create policy session_notes_insert on session_notes for insert
  with check (
    exists (select 1 from appointments a
           join patients p on p.id = a.patient_id
           where a.id = appointment_id
           and p.clinic_id = current_clinic_id())
    and (therapist_id = auth.uid() or app_current_role() = 'supervisor')
  );

-- FIX: adicionado join até patients.clinic_id para gestores/supervisores, mesmo padrão que
-- trial_data_read em outras policies. Therapist via appointment já passa clinic check implicitamente.
create policy trial_data_read on trial_data for select
  using (
    (
      app_current_role() in ('gestor','supervisor')
      and exists (select 1 from appointments a
                 join patients p on p.id = a.patient_id
                 where a.id = trial_data.appointment_id
                 and p.clinic_id = current_clinic_id())
    )
    or exists (select 1 from appointments a where a.id = trial_data.appointment_id and a.therapist_id = auth.uid())
  );

-- FIX: adicionado join até patients.clinic_id para garantir que therapist só insira dados
-- para appointments de sua própria clínica.
create policy trial_data_insert on trial_data for insert
  with check (
    exists (select 1 from appointments a
           join patients p on p.id = a.patient_id
           where a.id = appointment_id
           and a.therapist_id = auth.uid()
           and p.clinic_id = current_clinic_id())
  );

create function session_note_pending(p_appointment_id uuid) returns boolean
language sql stable as $$
  select exists (select 1 from appointments a where a.id = p_appointment_id and a.status = 'realizada')
     and not exists (select 1 from session_notes sn where sn.appointment_id = p_appointment_id);
$$;
