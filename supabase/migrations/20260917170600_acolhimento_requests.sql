-- supabase/migrations/20260917170600_acolhimento_requests.sql
-- Passo a passo de entrada de novos pacientes (Diretrizes de Entrada):
-- particular não exige encaminhamento médico e segue
-- solicitado -> aguardando_agendamento -> agendado -> aguardando_pagamento
-- -> realizado -> contrato_pendente -> grade_pendente -> concluido; convênio
-- exige pedido médico + guia validada (status='ativa') ANTES de agendar.
-- Setor administrativo = gestor (solicita a vaga); setor de agendamento
-- = supervisor (define os horários fixos) — sem perfis novos, conforme
-- lib/roles.ts.
create table acolhimento_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid not null references patients(id),
  funding text not null check (funding in ('particular','convenio')),
  specialty_value text,
  insurer_id uuid references insurers(id),
  status text not null default 'solicitado' check (status in (
    'solicitado','aguardando_agendamento','agendado','aguardando_pagamento',
    'realizado','contrato_pendente','grade_pendente','concluido','cancelado'
  )),
  appointment_id uuid references appointments(id),
  requested_by uuid references profiles(id),
  scheduled_by uuid references profiles(id),
  supervisor_id uuid references profiles(id),
  payment_confirmed_at timestamptz,
  presence_confirmed_at timestamptz,
  contract_delivered_at timestamptz,
  grade_defined_at timestamptz,
  family_informed_at timestamptz,
  whatsapp_group_at timestamptz,
  referral_document_id uuid references documents(id),
  authorization_id uuid references authorizations(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table acolhimento_requests enable row level security;

create policy acolhimento_requests_read on acolhimento_requests for select
  using (
    exists (select 1 from patients pt where pt.id = acolhimento_requests.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy acolhimento_requests_write on acolhimento_requests for insert
  with check (
    exists (select 1 from patients pt where pt.id = acolhimento_requests.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy acolhimento_requests_update on acolhimento_requests for update
  using (
    exists (select 1 from patients pt where pt.id = acolhimento_requests.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

-- Retorna o motivo de bloqueio (ou null se pode agendar). Particular sempre
-- passa; convênio exige documento 'pedido_medico' do paciente e guia com
-- status='ativa' — mesma checagem de appointments_prior_auth_guard, aqui
-- aplicada uma etapa antes (ainda na fila de acolhimento, antes de existir
-- appointment).
create function acolhimento_can_schedule(p_request_id uuid) returns text
language plpgsql stable as $$
declare
  r acolhimento_requests%rowtype;
  v_has_referral boolean;
  v_has_active_auth boolean;
begin
  select * into r from acolhimento_requests where id = p_request_id;
  if r.funding = 'particular' then
    return null;
  end if;

  select exists (
    select 1 from documents d where d.patient_id = r.patient_id and d.category = 'pedido_medico'
  ) into v_has_referral;

  if not v_has_referral then
    return 'PEDIDO_MEDICO_AUSENTE';
  end if;

  select exists (
    select 1 from authorizations au
    join patient_insurance pi on pi.id = au.patient_insurance_id
    where pi.patient_id = r.patient_id and au.status = 'ativa'
  ) into v_has_active_auth;

  if not v_has_active_auth then
    return 'GUIA_NAO_VALIDADA';
  end if;

  return null;
end;
$$;

create function trg_acolhimento_requests_schedule_guard() returns trigger
language plpgsql as $$
declare
  v_reason text;
begin
  if new.status = 'agendado' and old.status is distinct from new.status then
    v_reason := acolhimento_can_schedule(new.id);
    if v_reason is not null then
      raise exception '%', v_reason;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_acolhimento_requests_schedule_guard
  before update of status on acolhimento_requests
  for each row execute function trg_acolhimento_requests_schedule_guard();

-- Efeitos colaterais de transição de status sobre o checklist de entrada
-- (intake_steps) — mesmo espírito das triggers de 20260906000018 que
-- completam etapas a partir de eventos reais em vez de botão manual.
create function trg_acolhimento_requests_intake_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'agendado' then
      update intake_steps set status = 'concluida', completed_at = now()
      where patient_id = new.patient_id and step_key = 'vaga_acolhimento_solicitada' and status <> 'concluida';
    elsif new.status = 'realizado' then
      update intake_steps set status = 'concluida', completed_at = now()
      where patient_id = new.patient_id and step_key in ('anamnese_realizada','pagamento_acolhimento') and status <> 'concluida';
    elsif new.status = 'contrato_pendente' then
      update intake_steps set status = 'concluida', completed_at = now()
      where patient_id = new.patient_id and step_key = 'contrato_enviado' and status <> 'concluida';
    elsif new.status = 'grade_pendente' then
      null; -- concluida explicitamente por markGradeDefined (app/supervisao/acolhimento-actions.ts)
    elsif new.status = 'concluido' then
      update intake_steps set status = 'concluida', completed_at = now()
      where patient_id = new.patient_id and step_key in ('grupo_whatsapp','familia_informada') and status <> 'concluida';
    end if;

    insert into audit_log (table_name, row_id, action, actor_id, clinic_id, before, after)
    values ('acolhimento_requests', new.id, 'acolhimento_status_changed', null, new.clinic_id,
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;

create trigger trg_acolhimento_requests_intake_sync
  after update of status on acolhimento_requests
  for each row execute function trg_acolhimento_requests_intake_sync();

-- Quatro etapas novas no checklist de entrada, cobrindo o passo a passo de
-- acolhimento particular (vaga solicitada -> pagamento -> grade -> familia
-- informada). Altera a CHECK constraint + seed_intake_steps
-- (20260906000001) para os pacientes novos passarem a ganha-las.
alter table intake_steps drop constraint intake_steps_step_key_check;
alter table intake_steps add constraint intake_steps_step_key_check check (step_key in (
  'primeiro_contato', 'agendamento_anamnese', 'contrato_enviado', 'contrato_assinado',
  'pagamento_confirmado', 'grupo_whatsapp', 'anamnese_realizada', 'equipe_definida',
  'planejamento_avaliacao', 'avaliacoes_realizadas', 'reuniao_interdisciplinar',
  'pts_construido', 'pts_validado', 'devolutiva_familia',
  'vaga_acolhimento_solicitada', 'pagamento_acolhimento', 'grade_definida', 'familia_informada'
));

create or replace function seed_intake_steps(p_patient_id uuid) returns void
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
    (p_patient_id, 'pts_construido'),
    (p_patient_id, 'pts_validado'),
    (p_patient_id, 'devolutiva_familia'),
    (p_patient_id, 'vaga_acolhimento_solicitada'),
    (p_patient_id, 'pagamento_acolhimento'),
    (p_patient_id, 'grade_definida'),
    (p_patient_id, 'familia_informada')
  on conflict (patient_id, step_key) do nothing;
end;
$$;
