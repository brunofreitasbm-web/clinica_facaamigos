-- supabase/migrations/20260906000001_intake_journey.sql
-- Módulo 3 MAAIS (entrada, avaliação e devolutiva): checklist operacional de
-- entrada por paciente + anamnese como registro. Ver docs do módulo — a
-- pergunta que motiva isso é "se eu não estiver na clínica, consigo
-- acompanhar o percurso só pelos registros?".
--
-- intake_steps é o checklist das 10 etapas do fluxo de entrada (uma linha por
-- paciente x etapa). Etapas de convênio/particular que não se aplicam viram
-- 'nao_aplicavel' via trigger em patient_insurance, nunca são apagadas (a
-- recepção precisa ver que a etapa foi avaliada e descartada, não que nunca
-- existiu).

create table intake_steps (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  step_key text not null check (step_key in (
    'primeiro_contato', 'agendamento_anamnese', 'contrato_enviado', 'contrato_assinado',
    'pagamento_confirmado', 'grupo_whatsapp', 'anamnese_realizada', 'equipe_definida',
    'planejamento_avaliacao', 'avaliacoes_realizadas', 'reuniao_interdisciplinar',
    'pdi_construido', 'pdi_validado', 'devolutiva_familia'
  )),
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'nao_aplicavel')),
  due_at timestamptz,
  completed_by uuid references profiles(id),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (patient_id, step_key)
);

create index intake_steps_patient_id_idx on intake_steps(patient_id);

-- Anamnese ampliada (slide 10, etapa 3) — hoje só existia como texto solto no
-- mural. `structured` guarda o roteiro (rotina, escola, medicações,
-- prioridades da família — reaproveitadas depois no PDI, slide 22 "a família
-- relatou uma prioridade, mas ela não chegou ao PDI").
create table anamneses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  conducted_by uuid not null references profiles(id),
  conducted_at timestamptz not null default now(),
  structured jsonb not null default '{}'::jsonb,
  free_text text,
  presented_pillars boolean not null default false,
  presented_absence_policy boolean not null default false,
  presented_protocols boolean not null default false
);

create index anamneses_patient_id_idx on anamneses(patient_id);

alter table patients
  add column whatsapp_group_added_at timestamptz,
  add column payment_confirmed_at timestamptz,
  add column contract_sent_at timestamptz,
  add column contract_signed_at timestamptz;

alter table intake_steps enable row level security;
alter table anamneses enable row level security;

-- ── Seed do checklist ────────────────────────────────────────────────────
create function seed_intake_steps(p_patient_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into intake_steps (patient_id, step_key)
  values
    (p_patient_id, 'primeiro_contato'),
    (p_patient_id, 'agendamento_anamnese'),
    (p_patient_id, 'contrato_enviado'),
    (p_patient_id, 'contrato_assinado'),
    (p_patient_id, 'pagamento_confirmado'),
    (p_patient_id, 'grupo_whatsapp'),
    (p_patient_id, 'anamnese_realizada'),
    (p_patient_id, 'equipe_definida'),
    (p_patient_id, 'planejamento_avaliacao'),
    (p_patient_id, 'avaliacoes_realizadas'),
    (p_patient_id, 'reuniao_interdisciplinar'),
    (p_patient_id, 'pdi_construido'),
    (p_patient_id, 'pdi_validado'),
    (p_patient_id, 'devolutiva_familia')
  on conflict (patient_id, step_key) do nothing;
end;
$$;

create function trg_patients_seed_intake_steps() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform seed_intake_steps(new.id);
  return new;
end;
$$;

create trigger patients_seed_intake_steps
  after insert on patients
  for each row execute function trg_patients_seed_intake_steps();

-- Backfill: pacientes já existentes ganham o checklist agora.
do $$
declare p record;
begin
  for p in select id from patients loop
    perform seed_intake_steps(p.id);
  end loop;
end $$;

-- ── Conclusão automática de etapas a partir de eventos já existentes ────────
create function set_intake_step_complete(p_patient_id uuid, p_step_key text, p_completed_by uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update intake_steps
  set status = 'concluida', completed_at = now(), completed_by = coalesce(p_completed_by, auth.uid())
  where patient_id = p_patient_id and step_key = p_step_key and status = 'pendente';
end;
$$;

create function set_intake_step_na(p_patient_id uuid, p_step_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update intake_steps
  set status = 'nao_aplicavel'
  where patient_id = p_patient_id and step_key = p_step_key and status = 'pendente';
end;
$$;

create function trg_patients_intake_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.whatsapp_group_added_at is not null and old.whatsapp_group_added_at is null then
    perform set_intake_step_complete(new.id, 'grupo_whatsapp');
  end if;
  if new.contract_sent_at is not null and old.contract_sent_at is null then
    perform set_intake_step_complete(new.id, 'contrato_enviado');
  end if;
  if new.contract_signed_at is not null and old.contract_signed_at is null then
    perform set_intake_step_complete(new.id, 'contrato_assinado');
  end if;
  if new.payment_confirmed_at is not null and old.payment_confirmed_at is null then
    perform set_intake_step_complete(new.id, 'pagamento_confirmado');
  end if;
  if new.status = 'avaliacao' and old.status is distinct from 'avaliacao' then
    perform set_intake_step_complete(new.id, 'agendamento_anamnese');
  end if;
  if new.evaluated_at is not null and old.evaluated_at is null then
    perform set_intake_step_complete(new.id, 'planejamento_avaliacao');
    perform set_intake_step_complete(new.id, 'avaliacoes_realizadas');
  end if;
  return new;
end;
$$;

create trigger patients_intake_sync
  after update on patients
  for each row execute function trg_patients_intake_sync();

-- Convênio não exige confirmação de pagamento na entrada (slide 9,
-- "particular" tem etapa própria de pagamento; convênio não tem).
create function trg_patient_insurance_intake_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_private = false then
    perform set_intake_step_na(new.patient_id, 'pagamento_confirmado');
  end if;
  return new;
end;
$$;

create trigger patient_insurance_intake_sync
  after insert or update of is_private on patient_insurance
  for each row execute function trg_patient_insurance_intake_sync();

-- Anamnese conclui a etapa e liga o relógio dos 60 dias (slide 10, etapa 6:
-- "entrega do plano em até 60 dias" — contados a partir da anamnese, não do
-- cadastro).
create function trg_anamneses_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_intake_step_complete(new.patient_id, 'anamnese_realizada', new.conducted_by);
  update intake_steps
  set due_at = new.conducted_at + interval '60 days'
  where patient_id = new.patient_id and step_key = 'devolutiva_familia' and due_at is null;
  return new;
end;
$$;

create trigger anamneses_after_insert
  after insert on anamneses
  for each row execute function trg_anamneses_after_insert();

-- ── RLS ──────────────────────────────────────────────────────────────────
create policy intake_steps_read on intake_steps for select
  using (
    exists (select 1 from patients pt where pt.id = intake_steps.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor', 'supervisor', 'recepcao', 'faturamento')
      or has_patient_access(patient_id, array['terapeuta'])
    )
  );

create policy intake_steps_write on intake_steps for all
  using (
    app_current_role() in ('recepcao', 'supervisor', 'gestor')
    and exists (select 1 from patients pt where pt.id = intake_steps.patient_id and pt.clinic_id = current_clinic_id())
  );

create policy anamneses_read on anamneses for select
  using (
    exists (select 1 from patients pt where pt.id = anamneses.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor', 'supervisor', 'recepcao')
      or has_patient_access(patient_id, array['terapeuta'])
    )
  );

create policy anamneses_write on anamneses for insert
  with check (
    app_current_role() in ('terapeuta', 'supervisor')
    and exists (select 1 from patients pt where pt.id = anamneses.patient_id and pt.clinic_id = current_clinic_id())
  );
