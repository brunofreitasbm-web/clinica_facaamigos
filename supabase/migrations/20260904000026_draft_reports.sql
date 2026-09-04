-- supabase/migrations/20260904000026_draft_reports.sql
-- Item 9 do PRD "11 incrementos": agente IA pra consolidar o relatório
-- devolutivo familiar. `ai_draft` é o texto bruto que sai do modelo;
-- `final_text` é o que o terapeuta efetivamente edita e aprova — nunca
-- enviamos ai_draft direto pra família (aprovação manual obrigatória,
-- PRD §9).
create table draft_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  period_start date not null,
  period_end date not null,
  generated_by uuid not null references profiles(id),
  ai_draft text,
  final_text text,
  status text not null default 'gerado' check (status in ('gerado','em_revisao','aprovado','enviado')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

alter table draft_reports enable row level security;

-- Família NUNCA lê draft_reports diretamente — só recebe o resultado via
-- feed_posts (item 4) depois de aprovado e enviado. Leitura/escrita aqui é
-- só terapeuta vinculado/supervisor/gestor.
create policy draft_reports_read on draft_reports for select
  using (
    exists (select 1 from patients p where p.id = draft_reports.patient_id and p.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor')
      or has_patient_access(draft_reports.patient_id, array['terapeuta'])
    )
  );

create policy draft_reports_insert on draft_reports for insert
  with check (
    generated_by = auth.uid()
    and exists (select 1 from patients p where p.id = patient_id and p.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor')
      or has_patient_access(patient_id, array['terapeuta'])
    )
  );

create policy draft_reports_update on draft_reports for update
  using (
    exists (select 1 from patients p where p.id = draft_reports.patient_id and p.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor')
      or has_patient_access(draft_reports.patient_id, array['terapeuta'])
    )
  );
