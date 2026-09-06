-- supabase/migrations/20260906000019_family_reschedule_requests.sql
-- PRD §9.7/§3.4: "Pedido de remarcação" pelo portal da família — o
-- responsável não tem (nem deve ter) UPDATE em `appointments`
-- (appointments_update só permite recepcao/supervisor/gestor/therapist_id),
-- então isto não é um reagendamento de fato: é uma solicitação que abre uma
-- pendência pra recepção decidir/executar. Tabela isolada, mesmo motivo do
-- isolamento de absence_reports (20260904000023) — não reabre RLS já
-- auditada, e o caso de uso é distinto (pedir troca de dia futuro vs. avisar
-- falta de uma sessão específica).
create table reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  requested_by uuid not null references profiles(id),
  message text not null,
  status text not null default 'em_analise' check (status in ('em_analise', 'concluida')),
  created_at timestamptz not null default now(),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz
);

alter table reschedule_requests enable row level security;

create policy reschedule_requests_read on reschedule_requests for select
  using (
    exists (
      select 1 from appointments a join patients p on p.id = a.patient_id
      where a.id = reschedule_requests.appointment_id and p.clinic_id = current_clinic_id()
    )
    and (
      app_current_role() in ('gestor', 'supervisor', 'recepcao')
      or exists (
        select 1 from appointments a
        where a.id = reschedule_requests.appointment_id
          and has_patient_access(a.patient_id, array['responsavel'])
      )
    )
  );

-- Só o próprio responsável vinculado ao paciente da sessão pode pedir a
-- remarcação — requested_by = auth.uid() trava contra spoofing de outro
-- profile_id, mesmo padrão de absence_reports_insert.
create policy reschedule_requests_insert on reschedule_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from appointments a
      where a.id = appointment_id
        and has_patient_access(a.patient_id, array['responsavel'])
    )
  );

create policy reschedule_requests_update_staff on reschedule_requests for update
  using (
    exists (
      select 1 from appointments a join patients p on p.id = a.patient_id
      where a.id = reschedule_requests.appointment_id and p.clinic_id = current_clinic_id()
    )
    and app_current_role() in ('gestor', 'supervisor', 'recepcao')
  )
  with check (
    exists (
      select 1 from appointments a join patients p on p.id = a.patient_id
      where a.id = reschedule_requests.appointment_id and p.clinic_id = current_clinic_id()
    )
    and app_current_role() in ('gestor', 'supervisor', 'recepcao')
  );

-- PRD §3.4 também exige que o pedido "registre a mensagem no histórico do
-- paciente" — em vez de fazer dois inserts separados na Server Action (um
-- podendo falhar sem o outro), o trigger security definer garante que toda
-- reschedule_request vira uma linha em `messages` (mesmo padrão de
-- confirm_attendance ser tudo-ou-nada no banco).
create function reschedule_request_log_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_patient_id uuid;
  v_guardian_id uuid;
begin
  select a.patient_id into v_patient_id from appointments a where a.id = new.appointment_id;
  select g.id into v_guardian_id
    from guardians g
    where g.patient_id = v_patient_id and g.profile_id = new.requested_by
    limit 1;

  insert into messages (patient_id, guardian_id, channel, direction, template_key, body, sent_at, related_appointment_id)
  values (v_patient_id, v_guardian_id, 'portal', 'inbound', 'pedido_remarcacao', new.message, now(), new.appointment_id);

  return new;
end;
$$;

create trigger trg_reschedule_request_log_message after insert on reschedule_requests
  for each row execute function reschedule_request_log_message();
