-- supabase/migrations/20260907170007_fono_assessments.sql
--
-- Traz para dentro do sistema os três instrumentos de fonoaudiologia que a
-- clínica hoje preenche em planilhas Excel avulsas (Planilhas/Fono/
-- {ADL,ADL--2,PROC}.xlsx): ADL, ADL-2 e PROC. Diferente de
-- protocols/protocol_items/protocol_assessments (20260904000004_protocols.sql
-- — escala fixa 0/1/2, itens cadastrados pelo gestor, sem idade, sem
-- escores manuais, append-only), estes três instrumentos têm catálogo fixo
-- (embutido em lib/fono-instruments/, não cadastrável), respostas
-- heterogêneas por instrumento e cálculos próprios (lib/fono-instruments/
-- scoring.ts). Uma única tabela cobre os três: `instrument` seleciona o
-- catálogo e a fórmula usada para interpretar `responses`/`manual_scores`.
--
-- `birth_date`/`age_years`/`age_months` são um snapshot no momento da
-- aplicação (não um JOIN vivo com patients): a idade cronológica calculada
-- na hora do teste é parte do resultado clínico e não deve mudar se o
-- cadastro do paciente for corrigido depois.
create table fono_assessments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  instrument text not null check (instrument in ('adl', 'adl2', 'proc')),
  status text not null default 'rascunho' check (status in ('rascunho', 'concluida')),
  test_date date not null,
  birth_date date not null,
  age_years int not null check (age_years >= 0),
  age_months int not null check (age_months >= 0 and age_months < 12),
  assessed_by uuid not null references profiles(id),
  responses jsonb not null default '{}'::jsonb,
  manual_scores jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table fono_assessments enable row level security;

-- Leitura: gestor/supervisor veem tudo da clínica; terapeuta só pacientes
-- com patient_access do tipo 'terapeuta' (mesma semântica de
-- has_patient_access usada em protocol_assessments_read,
-- 20260904000004_protocols.sql:79-84). Nota: patient_access também é
-- concedido automaticamente a qualquer terapeuta escalado em agenda
-- (20260906000029_grant_patient_access_on_appointment_assignment.sql), então
-- "vinculado" aqui é um pouco mais amplo que só a equipe de avaliação fono
-- — mesmo comportamento já aceito para protocol_assessments e o prontuário.
create policy fono_assessments_read on fono_assessments for select
  using (
    clinic_id = (select current_clinic_id())
    and (
      (select app_current_role()) = any (array['gestor', 'supervisor'])
      or ((select app_current_role()) = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']))
    )
  );

create policy fono_assessments_manage_ins on fono_assessments for insert
  with check (
    clinic_id = (select current_clinic_id())
    and assessed_by = (select auth.uid())
    and (
      (select app_current_role()) = any (array['gestor', 'supervisor'])
      or ((select app_current_role()) = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']))
    )
  );

-- Update só enquanto `status = 'rascunho'` — uma avaliação concluída é
-- imutável na prática (mesmo padrão append-only de protocol_assessments e
-- session_notes: reavaliar = nova aplicação, não editar a antiga). O
-- `with check` repete clinic_id/role para impedir que um update "mova" o
-- rascunho para outra clínica; não trava `assessed_by` porque supervisor/
-- gestor precisam poder corrigir/completar um rascunho do terapeuta.
create policy fono_assessments_manage_upd on fono_assessments for update
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

create index idx_fono_assessments_patient on fono_assessments (patient_id, instrument, test_date desc);
