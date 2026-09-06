-- supabase/migrations/20260906000012_voice_emergency.sql
-- Central de Chamadas de Emergência por Voz (Menu Supervisão): disparo em
-- massa de ligações Twilio Voice quando um terapeuta falta de última hora.

create table voice_emergency_broadcasts (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references profiles(id),
  therapist_id uuid not null references profiles(id),
  occurrence_date date not null,
  shift text,
  message_template text not null,
  created_at timestamptz not null default now()
);

create table voice_emergency_logs (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references voice_emergency_broadcasts(id),
  patient_id uuid not null references patients(id),
  guardian_id uuid references guardians(id),
  phone_number text not null,
  call_sid text,
  call_status text not null default 'queued' check (call_status in ('queued','ringing','completed','no-answer','busy','failed')),
  attempt_number int not null default 1,
  fallback_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index voice_emergency_logs_broadcast_idx on voice_emergency_logs (broadcast_id);
create index voice_emergency_logs_call_sid_idx on voice_emergency_logs (call_sid);

alter table voice_emergency_broadcasts enable row level security;
alter table voice_emergency_logs enable row level security;

create policy voice_emergency_broadcasts_read on voice_emergency_broadcasts for select
  using (
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from profiles p where p.id = voice_emergency_broadcasts.therapist_id and p.clinic_id = current_clinic_id())
  );

create policy voice_emergency_broadcasts_write on voice_emergency_broadcasts for insert
  with check (
    app_current_role() in ('gestor','supervisor')
    and supervisor_id = auth.uid()
    and exists (select 1 from profiles p where p.id = voice_emergency_broadcasts.therapist_id and p.clinic_id = current_clinic_id())
  );

create policy voice_emergency_logs_read on voice_emergency_logs for select
  using (
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from patients pt where pt.id = voice_emergency_logs.patient_id and pt.clinic_id = current_clinic_id())
  );

-- Insert inicial acontece pela server action da supervisão (sessão do
-- usuário); as atualizações de status (call_status/attempt_number/
-- fallback_sent) vêm do webhook do Twilio via admin client, por isso não há
-- policy de update para papéis de aplicação.
create policy voice_emergency_logs_write on voice_emergency_logs for insert
  with check (
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from patients pt where pt.id = voice_emergency_logs.patient_id and pt.clinic_id = current_clinic_id())
  );
