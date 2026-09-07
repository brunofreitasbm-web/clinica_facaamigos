-- supabase/migrations/20260907000001_registration_drafts.sql
-- "Cadastro assistido por IA": o responsável manda fotos/PDF dos documentos
-- da criança pelo WhatsApp (Twilio) ou pelo upload do portal /familia; o
-- Gemini extrai os dados em JSON; a recepção confere numa tela e só então os
-- dados viram paciente/responsável/convênio/guia de verdade. Esta migration
-- cria a tabela de rascunho (`registration_drafts` + `registration_draft_files`)
-- e amplia patients/guardians com os campos que o cadastro manual não tinha
-- (CPF/sexo/naturalidade/endereço da criança, RG do responsável).

-- 1) Campos novos em patients/guardians ---------------------------------
alter table patients
  add column cpf text,
  add column sexo text check (sexo in ('F','M','outro')),
  add column naturalidade text,
  add column address_cep text,
  add column address_logradouro text,
  add column address_numero text,
  add column address_complemento text,
  add column address_bairro text,
  add column address_cidade text,
  add column address_uf text check (address_uf is null or address_uf ~ '^[A-Z]{2}$');

-- Unicidade de CPF por clínica (só quando preenchido) — ajuda a UI de
-- validação a detectar duplicata na hora de criar um pré-cadastro.
create unique index patients_cpf_clinic_unique on patients (clinic_id, cpf) where cpf is not null;

alter table guardians add column rg text;

-- 2) Categorias novas de documents ---------------------------------------
-- Mesmo padrão de 20260906000020_family_document_upload.sql: dropar e
-- recriar o CHECK com as categorias adicionais.
alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check check (category in (
  'pedido_medico', 'laudo', 'carteirinha', 'termo', 'relatorio_evolucao', 'reavaliacao',
  'autorizacao', 'outro',
  'contrato', 'termo_lgpd', 'termo_imagem', 'documento_responsavel',
  'kit_boas_vindas', 'carta_terapeuta', 'manual_clinica',
  'familia_envio',
  'certidao_nascimento', 'documento_identidade', 'comprovante_residencia'
));

-- 3) audit_log.action: hoje só aceita INSERT/UPDATE/DELETE, mas
-- documents-actions.ts:177 já grava action='download' há tempos (viola o
-- CHECK em silêncio — o insert falha e ninguém percebe porque o retorno da
-- Server Action não depende dele). Aproveitamos esta migration pra corrigir
-- isso e já habilitar os dois eventos novos do fluxo de rascunho.
alter table audit_log drop constraint audit_log_action_check;
alter table audit_log add constraint audit_log_action_check
  check (action in ('INSERT', 'UPDATE', 'DELETE', 'download', 'draft_validated', 'draft_rejected', 'draft_extracted'));

-- 4) registration_drafts ---------------------------------------------------
-- Um rascunho agrega um lote de arquivos enviados por um telefone (WhatsApp)
-- ou por um responsável logado (portal), extraídos pelo Gemini numa única
-- chamada. patient_id/guardian_id só são preenchidos quando o remetente já é
-- conhecido (guardians.phone) ou depois que a recepção valida um pré-cadastro
-- (número novo). Nenhum papel de aplicação tem policy de INSERT: só o
-- webhook do Twilio, a action do portal e o cron de extração (todos via
-- client admin) criam/alteram linhas fora do fluxo de validação — mesmo
-- desenho de chatbot_sessions/nps_surveys.
create table registration_drafts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  patient_id uuid references patients(id),
  guardian_id uuid references guardians(id),
  source text not null check (source in ('whatsapp', 'portal')),
  source_phone text,
  submitted_by uuid references profiles(id),
  guardian_message text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'extracted', 'validated', 'rejected', 'failed')),
  extracted jsonb,
  fields_confidence jsonb,
  warnings text[] not null default '{}',
  model text,
  error text,
  attempts int not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  last_file_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references profiles(id),
  rejected_at timestamptz,
  rejected_by uuid references profiles(id),
  reject_reason text
);

create table registration_draft_files (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references registration_drafts(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes int,
  original_name text,
  twilio_media_url text,
  detected_type text,
  document_id uuid references documents(id),
  created_at timestamptz not null default now()
);

create index registration_drafts_status_idx on registration_drafts (status)
  where status in ('pending', 'processing', 'extracted', 'failed');
create index registration_drafts_open_phone_idx on registration_drafts (source_phone, last_file_at)
  where status in ('pending', 'processing', 'extracted');
create index registration_drafts_patient_idx on registration_drafts (patient_id) where patient_id is not null;
create index registration_draft_files_draft_idx on registration_draft_files (draft_id);
-- Idempotência: a mesma mídia do Twilio (MediaUrl) nunca é baixada duas vezes,
-- mesmo se o webhook for reentregue.
create unique index registration_draft_files_twilio_unique on registration_draft_files (twilio_media_url)
  where twilio_media_url is not null;

alter table registration_drafts enable row level security;
alter table registration_draft_files enable row level security;

create policy registration_drafts_read on registration_drafts for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'));

create policy registration_drafts_read_own_family on registration_drafts for select
  using (
    source = 'portal'
    and submitted_by = auth.uid()
    and patient_id is not null
    and has_patient_access(patient_id, array['responsavel'])
  );

create policy registration_drafts_update on registration_drafts for update
  using (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('recepcao', 'supervisor', 'gestor'));

create policy registration_draft_files_read on registration_draft_files for select
  using (
    exists (
      select 1 from registration_drafts d
      where d.id = draft_id
        and d.clinic_id = current_clinic_id()
        and app_current_role() in ('recepcao', 'supervisor', 'gestor')
    )
  );

-- 5) Reivindicar rascunhos de forma atômica para o worker de extração ------
-- supabase-js não expressa `for update skip locked`; uma função SQL
-- security definer resolve isso e evita duas execuções do cron
-- processando o mesmo rascunho em paralelo. Só o service role chama (a
-- rota /api/extractions/process usa o client admin) — revogamos de
-- anon/authenticated como já se faz em 20260906000025 para
-- book_anamnesis_slot_atomic.
create function claim_registration_drafts(p_limit int default 3, p_draft_id uuid default null)
returns setof registration_drafts
language plpgsql security definer set search_path = public as $$
begin
  return query
  update registration_drafts d
  set status = 'processing', locked_at = now(), attempts = attempts + 1
  from (
    select id from registration_drafts
    where (
      p_draft_id is not null and id = p_draft_id and status in ('pending', 'extracted', 'failed')
    ) or (
      p_draft_id is null
      and attempts < 3
      and (
        (status = 'pending' and last_file_at < now() - interval '90 seconds')
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    )
    order by created_at
    limit p_limit
    for update skip locked
  ) claimed
  where d.id = claimed.id
  returning d.*;
end;
$$;

revoke all on function claim_registration_drafts(int, uuid) from public, anon, authenticated;

-- 6) Cron de extração (mirror de 20260906000011_nps_surveys.sql) -----------
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule(
    'process_registration_drafts',
    '* * * * *',
    $job$
      select net.http_post(
        url := coalesce(current_setting('app.settings.app_url', true), '') || '/api/extractions/process',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net indisponível neste ambiente — dispare /api/extractions/process externamente. %', sqlerrm;
end;
$$;
