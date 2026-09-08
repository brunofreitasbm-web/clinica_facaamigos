-- Onda 3, módulo Ouvidoria, Incidentes e Não Conformidades. NPS/feedback já
-- existem (family_feedback, nps_surveys) mas não há tratamento de
-- reclamações, eventos adversos (queda, crise comportamental, acidente) ou
-- não conformidades com plano de ação — o que alimenta o checklist de
-- maturidade em app/gestor/maturidade. POPs versionados citados no roadmap
-- original ficaram de fora desta entrega — é um recurso maior (documento
-- versionado clínica-wide, não paciente) que merece desenho próprio.

create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  kind text not null check (kind in ('reclamacao', 'evento_adverso', 'nao_conformidade')),
  severity text not null default 'baixa' check (severity in ('baixa', 'media', 'alta', 'critica')),
  patient_id uuid references patients(id) on delete set null,
  reported_by uuid not null references profiles(id) on delete restrict,
  description text not null,
  occurred_at timestamptz not null default now(),
  status text not null default 'aberto' check (status in ('aberto', 'em_analise', 'plano_de_acao', 'resolvido', 'arquivado')),
  action_plan text,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incident_reports_clinic_status_idx on incident_reports (clinic_id, status);

alter table incident_reports enable row level security;

-- Leitura/gestão: gestor e supervisão (governança clínica). Criação: qualquer
-- perfil da clínica que não seja família — quem testemunha um incidente
-- pode ser recepção ou terapeuta, não só gestor/supervisor.
create policy incident_reports_read on incident_reports
  for select using (
    clinic_id = current_clinic_id()
    and (app_current_role() in ('gestor', 'supervisor') or reported_by = auth.uid())
  );

create policy incident_reports_insert on incident_reports
  for insert with check (
    clinic_id = current_clinic_id()
    and app_current_role() in ('gestor', 'supervisor', 'terapeuta', 'recepcao', 'faturamento')
    and reported_by = auth.uid()
  );

create policy incident_reports_update on incident_reports
  for update using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor'));

create policy incident_reports_delete on incident_reports
  for delete using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');
