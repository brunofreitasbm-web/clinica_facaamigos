-- supabase/migrations/20260907170006_insurance_intake.sql
-- "Acolhimentos oriundos de plano de saúde": o convênio manda um PDF (layout
-- próprio de cada plano) com a relação de pacientes encaminhados. O
-- supervisor sobe o PDF em /supervisao (aba "Acolhimentos"); o Gemini extrai
-- uma linha por beneficiário (lib/insurance-intake-extraction.ts, mesmo
-- padrão de lib/document-extraction.ts); o supervisor revisa, corrige campos
-- de baixa confiança e aprova (individual ou em lote) — só aí um paciente de
-- verdade é criado e o bot do WhatsApp (lib/twilio-intake-bot.ts) começa a
-- pedir Laudo e Guia/Autorização ao responsável. Depois de validados os
-- documentos, o bot manda os horários vagos e o responsável escolhe pelo
-- WhatsApp (mesmo padrão de agendamento atômico de
-- lib/twilio-anamnesis-bot.ts). Mesma arquitetura do "cadastro assistido por
-- IA" (20260907000001_registration_drafts.sql): claim skip-locked + pg_cron
-- + rota de API, para não segurar o webhook do Twilio nem a Server Action de
-- upload além de alguns segundos.

-- 1) Perfil de extração por convênio ---------------------------------------
-- Cada plano de saúde manda um PDF em layout diferente. Em vez de uma tabela
-- separada (over-engineering para uma config pequena e 1:1), guardamos os
-- hints direto em insurers — mesmo precedente de `billing_rules jsonb`. O
-- shape (documentado em lib/insurance-intake-profile.ts) inclui dicas de
-- layout, palavras-chave para auto-detecção do convênio no PDF, mapeamento
-- de colunas e formato de data.
alter table insurers add column intake_extraction_profile jsonb not null default '{}'::jsonb;

-- Só gestor/supervisor editam o perfil (a policy de update de `insurers` —
-- insurers_manage_gestor, 20260904000003 — é só gestor; abrir isso pra
-- supervisor via policy geral abriria update de billing_rules/ans_code
-- também, então uma função dedicada e mais estreita é mais segura).
create function set_insurer_intake_profile(p_insurer_id uuid, p_profile jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if app_current_role() not in ('gestor', 'supervisor') then
    raise exception 'sem permissão para configurar o perfil de extração deste convênio';
  end if;

  update insurers
  set intake_extraction_profile = coalesce(p_profile, '{}'::jsonb)
  where id = p_insurer_id and clinic_id = current_clinic_id();

  if not found then
    raise exception 'convênio não encontrado nesta clínica';
  end if;
end;
$$;

revoke all on function set_insurer_intake_profile(uuid, jsonb) from public, anon;
grant execute on function set_insurer_intake_profile(uuid, jsonb) to authenticated;

-- 2) chatbot_sessions: namespacing por fluxo -------------------------------
-- `phone_number` é UNIQUE (20260906000009) — só uma sessão de bot ativa por
-- telefone. O bot de acolhimento (steps 'intake_*') convive com os fluxos
-- existentes (anamnese, pré-anamnese) da mesma forma que eles já convivem
-- entre si: só "pega" a mensagem se a sessão do telefone já estiver num step
-- do próprio prefixo. `lead_id` amarra a sessão ao lead sendo atendido, sem
-- que o step precise carregar esse dado dentro de `collected_data`.
alter table chatbot_sessions add column flow text;
alter table chatbot_sessions add column lead_id uuid;
create index chatbot_sessions_lead_idx on chatbot_sessions (lead_id) where lead_id is not null;

-- 3) Lotes de PDF enviados pelo convênio ------------------------------------
create table insurance_intake_batches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  insurer_id uuid references insurers(id),
  detected_insurer_name text,
  storage_path text not null,
  original_name text,
  mime_type text not null default 'application/pdf',
  size_bytes int,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'extracted', 'failed')),
  extracted jsonb,
  warnings text[] not null default '{}',
  model text,
  error text,
  attempts int not null default 0,
  locked_at timestamptz,
  leads_count int not null default 0,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index insurance_intake_batches_status_idx on insurance_intake_batches (status)
  where status in ('pending', 'processing', 'failed');
create index insurance_intake_batches_clinic_idx on insurance_intake_batches (clinic_id, created_at desc);

-- 4) Leads (um por paciente/responsável extraído do lote) -------------------
create table insurance_intake_leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  batch_id uuid not null references insurance_intake_batches(id) on delete cascade,
  insurer_id uuid references insurers(id),
  row_index int not null,

  -- Dados extraídos (editáveis pelo supervisor antes de aprovar).
  patient_full_name text,
  patient_birth_date date,
  patient_cpf text,
  patient_sexo text check (patient_sexo in ('F', 'M') or patient_sexo is null),
  patient_cid text,
  guardian_full_name text,
  guardian_cpf text,
  guardian_relationship text,
  guardian_email text,
  guardian_phone_raw text,
  phone_e164 text,
  card_number text,
  plan_name text,
  card_valid_until date,
  guide_number text,
  procedure_code text,
  sessions_authorized int,
  valid_from date,
  valid_to date,
  authorization_password text,
  extra jsonb not null default '{}'::jsonb,

  confidence jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}',

  -- Dedup contra paciente já cadastrado (cpf / telefone / nome+nascimento).
  duplicate_patient_id uuid references patients(id),
  duplicate_reason text,

  status text not null default 'extracted' check (status in (
    'extracted', 'approved', 'awaiting_documents', 'pending_supervisor',
    'awaiting_slot', 'scheduled', 'failed', 'cancelled'
  )),
  status_reason text,
  rejection_count int not null default 0,

  patient_id uuid references patients(id),
  guardian_id uuid references guardians(id),
  conversation_id uuid references twilio_conversations(id),
  patient_insurance_id uuid references patient_insurance(id),
  authorization_id uuid references authorizations(id),
  appointment_id uuid references appointments(id),

  offered_slots jsonb,
  slots_sent_at timestamptz,

  approved_at timestamptz,
  approved_by uuid references profiles(id),
  contact_sent_at timestamptz,
  last_file_at timestamptz,
  docs_reviewed_at timestamptz,
  docs_reviewed_by uuid references profiles(id),
  scheduled_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index insurance_intake_leads_batch_idx on insurance_intake_leads (batch_id);
create index insurance_intake_leads_status_idx on insurance_intake_leads (clinic_id, status);
-- Garante um único lead "ativo" por telefone — a aplicação também confere
-- isso antes de iniciar contato, mas o índice é a rede de segurança contra
-- corrida entre duas aprovações simultâneas do mesmo responsável.
create unique index insurance_intake_leads_active_phone_idx on insurance_intake_leads (phone_e164)
  where status in ('awaiting_documents', 'pending_supervisor', 'awaiting_slot');

-- 5) Arquivos recebidos do responsável por WhatsApp para cada lead ---------
create table insurance_intake_lead_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references insurance_intake_leads(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes int,
  original_name text,
  twilio_media_url text,
  kind text check (kind in ('laudo', 'guia', 'outro') or kind is null),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id),
  document_id uuid references documents(id),
  created_at timestamptz not null default now()
);

create index insurance_intake_lead_files_lead_idx on insurance_intake_lead_files (lead_id);
-- Idempotência: reentrega do webhook do Twilio nunca baixa a mesma mídia duas vezes.
create unique index insurance_intake_lead_files_twilio_unique on insurance_intake_lead_files (twilio_media_url)
  where twilio_media_url is not null;

alter table insurance_intake_batches enable row level security;
alter table insurance_intake_leads enable row level security;
alter table insurance_intake_lead_files enable row level security;

create policy insurance_intake_batches_read on insurance_intake_batches for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'));
create policy insurance_intake_batches_insert on insurance_intake_batches for insert
  with check (
    clinic_id = current_clinic_id()
    and app_current_role() in ('supervisor', 'gestor')
    and uploaded_by = auth.uid()
  );
create policy insurance_intake_batches_update on insurance_intake_batches for update
  using (clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor'));

create policy insurance_intake_leads_read on insurance_intake_leads for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'));
create policy insurance_intake_leads_update on insurance_intake_leads for update
  using (clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor'));
-- Sem policy de insert: só o cron de extração (client admin) cria leads.

create policy insurance_intake_lead_files_read on insurance_intake_lead_files for select
  using (
    exists (
      select 1 from insurance_intake_leads l
      where l.id = lead_id
        and l.clinic_id = current_clinic_id()
        and app_current_role() in ('recepcao', 'supervisor', 'gestor')
    )
  );
create policy insurance_intake_lead_files_update on insurance_intake_lead_files for update
  using (
    exists (
      select 1 from insurance_intake_leads l
      where l.id = lead_id and l.clinic_id = current_clinic_id() and app_current_role() in ('supervisor', 'gestor')
    )
  );
-- Sem policy de insert: só o bot do WhatsApp (client admin) anexa arquivos.

-- 6) audit_log.action -------------------------------------------------------
alter table audit_log drop constraint audit_log_action_check;
alter table audit_log add constraint audit_log_action_check check (action in (
  'INSERT', 'UPDATE', 'DELETE', 'download', 'draft_validated', 'draft_rejected', 'draft_extracted',
  'intake_batch_uploaded', 'intake_batch_extracted', 'intake_lead_approved', 'intake_contact_sent',
  'intake_docs_approved', 'intake_docs_rejected', 'intake_lead_scheduled', 'intake_lead_cancelled'
));

-- 7) Reivindicar lotes para o worker de extração (mesmo padrão de
-- claim_registration_drafts, 20260907000001) -------------------------------
create function claim_insurance_intake_batches(p_limit int default 2, p_batch_id uuid default null)
returns setof insurance_intake_batches
language plpgsql security definer set search_path = public as $$
begin
  return query
  update insurance_intake_batches b
  set status = 'processing', locked_at = now(), attempts = attempts + 1
  from (
    select id from insurance_intake_batches
    where (
      p_batch_id is not null and id = p_batch_id and status in ('pending', 'extracted', 'failed')
    ) or (
      p_batch_id is null
      and attempts < 3
      and (
        status = 'pending'
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    )
    order by created_at
    limit p_limit
    for update skip locked
  ) claimed
  where b.id = claimed.id
  returning b.*;
end;
$$;

revoke all on function claim_insurance_intake_batches(int, uuid) from public, anon, authenticated;

-- 8) Cron de extração (mirror de 20260907000001_registration_drafts.sql) ---
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
    'process_insurance_intake',
    '* * * * *',
    $job$
      select net.http_post(
        url := coalesce(current_setting('app.settings.app_url', true), '') || '/api/intake/process',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net indisponível neste ambiente — dispare /api/intake/process externamente. %', sqlerrm;
end;
$$;

-- 9) Agendamento atômico da avaliação a partir do lead ---------------------
-- Diferente de book_anamnesis_slot_atomic (20260906000024): aqui o paciente
-- já foi criado na aprovação do lead (approveIntakeLeadsAndStartContact), a
-- RPC só reserva o horário. Mesma checagem de conflito por tstzrange (a
-- exclusão gist de `appointments` é a rede de segurança final — capturamos
-- exclusion_violation pra devolver um erro amigável em vez de propagar).
create function book_intake_lead_slot_atomic(
  p_lead_id uuid,
  p_therapist_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_discipline text default 'Avaliação Multifuncional'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
  v_conflict_count integer;
  v_appointment_id uuid;
begin
  select * into v_lead from insurance_intake_leads where id = p_lead_id for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Acolhimento não encontrado.');
  end if;

  if v_lead.status = 'scheduled' then
    return jsonb_build_object('success', false, 'error', 'Este acolhimento já foi agendado anteriormente.');
  end if;

  if v_lead.status <> 'awaiting_slot' then
    return jsonb_build_object('success', false, 'error', 'Este acolhimento ainda não está aguardando escolha de horário.');
  end if;

  if v_lead.patient_id is null then
    return jsonb_build_object('success', false, 'error', 'Acolhimento sem paciente vinculado.');
  end if;

  select count(*) into v_conflict_count
  from appointments
  where (therapist_id = p_therapist_id or room_id = p_room_id)
    and status not in ('cancelada_familia', 'cancelada_terapeuta', 'cancelada_clinica', 'remarcada')
    and tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at);

  if v_conflict_count > 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'O horário selecionado acabou de ser reservado por outro paciente. Escolha outro horário vago.'
    );
  end if;

  begin
    insert into appointments (
      patient_id, therapist_id, room_id, discipline, starts_at, ends_at, modality, status, is_evaluation
    ) values (
      v_lead.patient_id, p_therapist_id, p_room_id, p_discipline, p_starts_at, p_ends_at, 'individual', 'agendada', true
    ) returning id into v_appointment_id;
  exception when exclusion_violation then
    return jsonb_build_object(
      'success', false,
      'error', 'O horário selecionado acabou de ser reservado por outro paciente. Escolha outro horário vago.'
    );
  end;

  update insurance_intake_leads
  set status = 'scheduled',
      appointment_id = v_appointment_id,
      scheduled_at = now(),
      updated_at = now()
  where id = p_lead_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'patient_id', v_lead.patient_id,
    'starts_at', p_starts_at,
    'ends_at', p_ends_at
  );
end;
$$;

revoke all on function book_intake_lead_slot_atomic(uuid, uuid, uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
