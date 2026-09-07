-- supabase/migrations/20260907170007_intervention_catalog.sql
-- Interações/técnicas do terapeuta durante a sessão ("intervenções"), que
-- alimentam a evolução clínica — hoje só existe o registro funcional ABC
-- (aba_abc_logs, 20260904000030_aba_clinical_module.sql), específico de
-- comportamento-problema em ABA. Este módulo é genérico entre disciplinas:
-- o terapeuta marca qual técnica aplicou ao longo do atendimento (reforço
-- positivo, dica verbal, modelagem, etc.) e o resultado, formando uma linha
-- do tempo que a evolução (session_notes) sintetiza no texto livre.
--
-- Segue exatamente o par de padrões já usados em behavior_catalog (catálogo
-- configurável pelo supervisor, imutável na prática — desativa, nunca
-- apaga) e aba_abc_logs (linha do tempo append-only por sessão).

create table intervention_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  value text not null,
  label text not null,
  discipline text,                       -- null = vale para todas as disciplinas
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, value),
  constraint intervention_catalog_value_format check (value ~ '^[a-z0-9_]{2,40}$')
);

alter table intervention_catalog enable row level security;

create policy intervention_catalog_read on intervention_catalog for select
  using (clinic_id = (select current_clinic_id()));

-- Policies separadas por comando (20260905123903_consolidate_manage_policies_perf.sql).
create policy intervention_catalog_manage_ins on intervention_catalog for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy intervention_catalog_manage_upd on intervention_catalog for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));

create index idx_intervention_catalog_clinic_active
  on intervention_catalog (clinic_id, active, sort_order);

insert into intervention_catalog (clinic_id, value, label, sort_order)
select c.id, v.value, v.label, v.ord
from clinics c
cross join (values
  ('reforco_positivo', 'Reforço positivo', 1),
  ('dica_verbal', 'Dica verbal', 2),
  ('dica_gestual', 'Dica gestual', 3),
  ('ajuda_fisica', 'Ajuda física', 4),
  ('modelagem', 'Modelagem', 5),
  ('feedback_corretivo', 'Feedback corretivo', 6),
  ('redirecionamento', 'Redirecionamento', 7),
  ('pausa_sensorial', 'Pausa sensorial', 8),
  ('outra', 'Outra', 9)
) as v(value, label, ord)
on conflict (clinic_id, value) do nothing;

-- Linha do tempo de ocorrências dentro da sessão: cada marcação do
-- terapeuta é uma linha, nunca editada/apagada (mesmo desenho de
-- aba_abc_logs) — o histórico completo é o que alimenta a síntese da
-- evolução, então corrigir um registro errado é logar um novo, não mudar o
-- antigo.
create table session_intervention_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  therapist_id uuid not null references profiles(id),
  intervention_value text not null,
  description text,
  resultado text check (resultado in ('sem_resposta', 'resposta_parcial', 'resposta_esperada')),
  recorded_at timestamptz not null default now()
);

alter table session_intervention_logs enable row level security;

create policy session_intervention_logs_read on session_intervention_logs for select
  using (
    exists (
      select 1 from patients p
      where p.id = session_intervention_logs.patient_id
      and p.clinic_id = (select current_clinic_id())
    )
    and (
      (select app_current_role()) in ('gestor', 'supervisor')
      or therapist_id = auth.uid()
      or has_patient_access(patient_id, array['terapeuta'])
    )
  );

create policy session_intervention_logs_insert on session_intervention_logs for insert
  with check (
    therapist_id = auth.uid()
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = appointment_id
      and p.clinic_id = (select current_clinic_id())
      and a.therapist_id = auth.uid()
    )
  );

create index idx_session_intervention_logs_appointment on session_intervention_logs(appointment_id);
create index idx_session_intervention_logs_patient on session_intervention_logs(patient_id, recorded_at desc);
