-- supabase/migrations/20260913040000_at_therapeutic_followup.sql
-- Fluxo de Acompanhamento Terapêutico (AT): atendimento em campo (escola,
-- domicílio, comunidade), não na sala da clínica — por isso não usa
-- `appointments` (exige `room_id` de sala física). Reaproveita o que já
-- existe em vez de duplicar: reunião com escola usa `meetings`
-- (`kind='visita_escolar'`, 20260906000004_meetings_and_bonding.sql) e
-- cadastro de escola usa `external_contacts` (`kind='escola'`,
-- 20260908080002_external_network.sql). Não cria papel novo — o
-- profissional de AT continua `profiles.role='terapeuta'`, só ganha a flag
-- `is_at_professional` (mesmo papel de gate que `is_evaluator` já tem hoje).

-- ---------------------------------------------------------------------------
-- Flag do profissional de AT
-- ---------------------------------------------------------------------------
alter table profiles add column is_at_professional boolean not null default false;

-- ---------------------------------------------------------------------------
-- Reuso: liga a reunião de visita escolar à escola específica cadastrada na
-- rede externa, e enriquece o cadastro de escola com endereço/série do aluno.
-- ---------------------------------------------------------------------------
alter table meetings add column external_contact_id uuid references external_contacts(id) on delete set null;

alter table external_contacts add column address text;
alter table external_contacts add column grade_level text;

-- Orientação de professores é um log de contato com a escola, igual a
-- "relatorio_compartilhado" já é hoje — não uma tabela nova. `at_session_id`
-- é opcional: liga a orientação à visita em que ela aconteceu quando for o
-- caso, sem obrigar isso (orientação também pode ser feita por telefone/e-mail
-- fora de uma sessão em campo).
alter table external_contact_logs drop constraint external_contact_logs_channel_check;
alter table external_contact_logs add constraint external_contact_logs_channel_check
  check (channel in ('telefone', 'email', 'reuniao', 'relatorio_compartilhado', 'orientacao_professor', 'outro'));

-- Documento novo: relatório de AT para a escola (timbrado).
alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check check (category in
  ('pedido_medico','laudo','carteirinha','termo','relatorio_evolucao','reavaliacao','autorizacao','relatorio_at_escola','outro'));

-- ---------------------------------------------------------------------------
-- Catálogo de modalidade de AT (escolar, domiciliar, comunitária, clínica…)
-- ---------------------------------------------------------------------------
create table at_modalities (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

alter table at_modalities enable row level security;

create policy at_modalities_read on at_modalities for select
  using (clinic_id = current_clinic_id());

create policy at_modalities_manage_ins on at_modalities for insert
  with check (clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor'));
create policy at_modalities_manage_upd on at_modalities for update
  using (clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor'));
create policy at_modalities_manage_del on at_modalities for delete
  using (clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor'));

-- ---------------------------------------------------------------------------
-- Registro de sessão de AT em campo: horas, local, evolução do AT.
-- ---------------------------------------------------------------------------
create table at_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  professional_id uuid not null references profiles(id),
  modality_id uuid not null references at_modalities(id),
  session_date date not null,
  start_time time not null,
  end_time time not null,
  location_kind text not null check (location_kind in ('escola', 'domicilio', 'comunidade', 'outro')),
  school_contact_id uuid references external_contacts(id) on delete set null,
  location_detail text,
  evolution text not null,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (location_kind <> 'escola' or school_contact_id is not null)
);

create index at_sessions_patient_idx on at_sessions (patient_id);
create index at_sessions_professional_idx on at_sessions (professional_id);

alter table at_sessions enable row level security;

create policy at_sessions_read on at_sessions for select
  using (
    clinic_id = current_clinic_id()
    and (app_current_role() in ('gestor', 'supervisor') or has_patient_access(patient_id, array['terapeuta']))
  );

-- A flag `is_at_professional` é aplicada aqui, não só na UI: um terapeuta
-- sem ela não consegue inserir sessão de AT mesmo chamando a action direto.
create policy at_sessions_write on at_sessions for insert
  with check (
    clinic_id = current_clinic_id()
    and created_by = auth.uid()
    and (
      app_current_role() in ('supervisor', 'gestor')
      or (
        app_current_role() = 'terapeuta'
        and has_patient_access(patient_id, array['terapeuta'])
        and exists (select 1 from profiles p where p.id = auth.uid() and p.is_at_professional)
      )
    )
  );
