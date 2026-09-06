-- supabase/migrations/20260906000014_family_feedback.sql
--
-- "Avalie" no portal da família: página permanente (sem limite de
-- periodicidade), distinta de `survey_responses` (pesquisa trimestral,
-- 1 resposta/trimestre) e de `nps_surveys` (disparo automático via Twilio,
-- escala 1-5). Até 4 categorias fixas avaliadas em escala de 4 pontos
-- (ruim/regular/bom/ótimo) + texto livre de críticas ou sugestões.
--
-- Concilia com o NPS do Twilio em app/gestor/nps/page.tsx, que normaliza
-- as três fontes para uma escala 0-10 comum e as apresenta no mesmo painel.
create table family_feedback (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  guardian_id uuid not null references guardians(id),
  -- chaves fixas: recepcao | terapeuta | agendamento | comunicacao,
  -- valores em ('ruim','regular','bom','otimo'). No máximo 4 categorias.
  category_ratings jsonb not null default '{}'::jsonb,
  comments text,
  created_at timestamptz not null default now()
);

create index family_feedback_patient_idx on family_feedback (patient_id);
create index family_feedback_created_at_idx on family_feedback (created_at desc);

alter table family_feedback enable row level security;

-- Mesmo padrão de survey_responses_write (20260904000031): confere que o
-- guardian logado é responsável pelo paciente informado.
create policy family_feedback_write on family_feedback for insert
  with check (
    exists (
      select 1 from guardians g
      where g.id = family_feedback.guardian_id
        and g.profile_id = auth.uid()
        and g.patient_id = family_feedback.patient_id
    )
  );

create policy family_feedback_read on family_feedback for select
  using (
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from patients pt where pt.id = family_feedback.patient_id and pt.clinic_id = current_clinic_id())
  );
