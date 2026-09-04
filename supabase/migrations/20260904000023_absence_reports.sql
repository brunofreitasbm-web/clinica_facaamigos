-- supabase/migrations/20260904000023_absence_reports.sql
-- Item 5 do PRD "11 incrementos": fluxo "Informar Falta" pela família.
-- Anexo fica em tabela/bucket próprios (não em `documents`) de propósito —
-- `documents` (20260904000008) não dá insert para o papel `responsavel`, e
-- misturar anexos de família com documentos clínicos/administrativos
-- exigiria reabrir uma RLS já auditada várias vezes (ver comentários em
-- 20260904000002b/003b). Mais simples e mais seguro manter isolado.
create table absence_reports (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  reported_by uuid not null references profiles(id),
  reason_category text not null check (reason_category in ('doenca','viagem','compromisso','outro')),
  reason_text text,
  attachment_storage_path text,
  status text not null default 'em_analise' check (status in ('em_analise','aprovado','rejeitado')),
  created_at timestamptz not null default now(),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz
);

alter table absence_reports enable row level security;

create policy absence_reports_read on absence_reports for select
  using (
    exists (
      select 1 from appointments a join patients p on p.id = a.patient_id
      where a.id = absence_reports.appointment_id and p.clinic_id = current_clinic_id()
    )
    and (
      app_current_role() in ('gestor','supervisor','recepcao')
      or exists (
        select 1 from appointments a
        where a.id = absence_reports.appointment_id
          and has_patient_access(a.patient_id, array['responsavel'])
      )
    )
  );

-- Só o próprio responsável vinculado ao paciente da sessão pode informar a
-- falta — reported_by = auth.uid() trava contra spoofing de outro profile_id.
create policy absence_reports_insert on absence_reports for insert
  with check (
    reported_by = auth.uid()
    and exists (
      select 1 from appointments a
      where a.id = appointment_id
        and has_patient_access(a.patient_id, array['responsavel'])
    )
  );

-- Só recepção/supervisor/gestor decidem um chamado 'em_analise' (aprovar/
-- rejeitar) — mesmo conjunto de papéis de messages_update_staff (020021).
create policy absence_reports_update_staff on absence_reports for update
  using (
    exists (
      select 1 from appointments a join patients p on p.id = a.patient_id
      where a.id = absence_reports.appointment_id and p.clinic_id = current_clinic_id()
    )
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

-- security definer (mesmo padrão de refresh_reassessment_alerts): o
-- responsável que insere a linha não tem policy de UPDATE em `appointments`
-- (appointments_update só permite recepcao/supervisor/gestor/therapist_id),
-- então sem bypassar RLS aqui a mudança de status da sessão não aplicaria.
-- Regra do PRD §5: anexo (atestado) OU categoria 'doenca' já aprova
-- automaticamente e marca a sessão como falta justificada; o resto fica
-- 'em_analise' até a recepção decidir manualmente.
create function absence_report_apply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.attachment_storage_path is not null or new.reason_category = 'doenca' then
    new.status := 'aprovado';
    new.resolved_at := now();
    update appointments
      set status = 'falta_familia',
          cancel_reason = new.reason_category,
          cancelled_by = new.reported_by,
          cancelled_at = now()
      where id = new.appointment_id
        and status in ('agendada','confirmada');
  end if;
  return new;
end;
$$;

create trigger trg_absence_report_apply before insert on absence_reports
  for each row execute function absence_report_apply();

-- Bucket dedicado pro anexo (atestado/comprovante) — mesmo motivo do
-- isolamento de tabela acima: não reaproveita clinic-documents.
insert into storage.buckets (id, name, public, file_size_limit)
values ('absence-attachments', 'absence-attachments', false, 26214400)
on conflict (id) do nothing;
