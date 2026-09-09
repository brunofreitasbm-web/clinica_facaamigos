-- Ficha do paciente preenchida pela família (pré-anamnese).
--
-- A família recebe um link público e preenche sem login, então o alvo do
-- formulário não pode ser o `patients.id` na URL: isso transformaria um UUID
-- vazado num leitor do prontuário. O link carrega um token opaco de uso
-- único, nesta tabela, resolvido no servidor — mesmo desenho de
-- `clinic_checkin_tokens` (20260908040000), onde o cartaz da entrada também
-- é público e o token é a única credencial.
--
-- Diferenças em relação ao token do cartaz, porque aqui o alvo é UM paciente
-- e não a clínica inteira:
--   * `expires_at`  — o link morre sozinho; um cartaz fica na parede, um
--                     convite de ficha não deveria valer para sempre;
--   * `submitted_at`— uso único: depois de enviado, o link para de abrir;
--   * `submitted_payload` — o que a família de fato enviou, como chegou.
--
-- O payload existe porque este fluxo grava direto em `patients`/`guardians`
-- com service-role, sem passar pela revisão da recepção (`registration_drafts`).
-- Sem ele não haveria como saber depois quem alterou a ficha nem para quê:
-- é a única trilha de auditoria desta escrita.
create table patient_intake_form_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  -- 24 bytes = 48 hex. Bem acima do token de 12 bytes do cartaz: aquele
  -- protege uma fila de check-in, este abre dados de uma criança.
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  active boolean not null default true,
  expires_at timestamptz not null default now() + interval '30 days',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  submitted_payload jsonb,
  revoked_at timestamptz
);

-- A busca do fluxo público é sempre "token → linha ainda válida".
create index patient_intake_form_tokens_open_idx
  on patient_intake_form_tokens (token)
  where active and submitted_at is null;

create index idx_patient_intake_form_tokens_patient
  on patient_intake_form_tokens (patient_id);

alter table patient_intake_form_tokens enable row level security;

-- A rota pública NÃO lê por aqui: ela usa service-role, que ignora RLS.
-- Estas policies valem para a equipe logada, que gera e acompanha os convites.
create policy patient_intake_form_tokens_read on patient_intake_form_tokens for select
  using (
    exists (
      select 1 from patients pt
      where pt.id = patient_intake_form_tokens.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) in ('gestor','supervisor','recepcao')
  );

create policy patient_intake_form_tokens_insert on patient_intake_form_tokens for insert
  with check (
    exists (
      select 1 from patients pt
      where pt.id = patient_intake_form_tokens.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) in ('gestor','supervisor','recepcao')
  );

-- Revogar um link vazado é a contramedida principal deste desenho.
create policy patient_intake_form_tokens_update on patient_intake_form_tokens for update
  using (
    exists (
      select 1 from patients pt
      where pt.id = patient_intake_form_tokens.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (select app_current_role()) in ('gestor','supervisor','recepcao')
  );
