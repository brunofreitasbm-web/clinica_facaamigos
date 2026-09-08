-- supabase/migrations/20260908010000_socially_savvy_assessments.sql
--
-- Traz para dentro do sistema o Socially Savvy, hoje preenchido na planilha
-- avulsa Planilhas/SOCIALLY--SAVVY-PEI.xlsx: 110 habilidades em 7 áreas do
-- desenvolvimento social, pontuadas de 0 a 3 (ou NA) em até quatro aplicações,
-- de onde sai o PEI (objetivos prioritários = habilidades pontuadas com 2;
-- demais objetivos = pontuadas com 0 ou 1).
--
-- Por que uma tabela própria e não `protocol_assessments`
-- (20260904000004_protocols.sql): lá a escala é fixa em 0/1/2, os itens são
-- cadastrados pelo gestor e não há rascunho. Aqui a escala é 0..3 + NA, o
-- catálogo é fixo em código (lib/socially-savvy/catalog.ts, como
-- lib/fono-instruments/) e o cálculo de áreas/PEI é próprio
-- (lib/socially-savvy/scoring.ts). O nome `socially_savvy` continua existindo
-- em lib/protocol-catalog.ts para o checklist genérico; esta tabela é o
-- instrumento completo.
--
-- Por que não entrou em `fono_assessments` (20260907170007): aquela tabela é
-- dos instrumentos de fonoaudiologia e carrega snapshot de idade cronológica,
-- que não faz parte deste protocolo.
--
-- `round` é a aplicação (1 a 4), equivalente às colunas AV 1..AV 4 da planilha,
-- e é o eixo do gráfico de evolução. Único por paciente para impedir duas
-- "AV 2" concorrentes; reavaliar depois da quarta aplicação é iniciar um novo
-- ciclo, decisão clínica que fica com o supervisor.
create table socially_savvy_assessments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  round int not null check (round between 1 and 4),
  status text not null default 'rascunho' check (status in ('rascunho', 'concluida')),
  assessment_date date not null,
  assessed_by uuid not null references profiles(id),
  responses jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, round)
);

alter table socially_savvy_assessments enable row level security;

-- Mesma semântica de fono_assessments_read: gestor/supervisor veem tudo da
-- clínica; terapeuta só pacientes com patient_access do tipo 'terapeuta'.
create policy socially_savvy_assessments_read on socially_savvy_assessments for select
  using (
    clinic_id = (select current_clinic_id())
    and (
      (select app_current_role()) = any (array['gestor', 'supervisor'])
      or ((select app_current_role()) = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']))
    )
  );

create policy socially_savvy_assessments_manage_ins on socially_savvy_assessments for insert
  with check (
    clinic_id = (select current_clinic_id())
    and assessed_by = (select auth.uid())
    and (
      (select app_current_role()) = any (array['gestor', 'supervisor'])
      or ((select app_current_role()) = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']))
    )
  );

-- Update só enquanto `status = 'rascunho'` — uma aplicação concluída é
-- imutável (mesmo padrão append-only de fono_assessments e session_notes:
-- reavaliar é abrir a aplicação seguinte, não editar a anterior). Não trava
-- `assessed_by` porque supervisor/gestor precisam poder completar o rascunho
-- do terapeuta.
create policy socially_savvy_assessments_manage_upd on socially_savvy_assessments for update
  using (
    status = 'rascunho'
    and clinic_id = (select current_clinic_id())
    and (
      (select app_current_role()) = any (array['gestor', 'supervisor'])
      or ((select app_current_role()) = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']))
    )
  )
  with check (
    clinic_id = (select current_clinic_id())
    and (
      (select app_current_role()) = any (array['gestor', 'supervisor'])
      or ((select app_current_role()) = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']))
    )
  );

create index idx_socially_savvy_assessments_patient on socially_savvy_assessments (patient_id, round);
create index idx_socially_savvy_assessments_clinic on socially_savvy_assessments (clinic_id);
create index idx_socially_savvy_assessments_assessed_by on socially_savvy_assessments (assessed_by);
