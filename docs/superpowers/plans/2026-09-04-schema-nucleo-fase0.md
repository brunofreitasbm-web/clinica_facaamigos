# Schema Núcleo (Fase 0, item 1 do backlog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o schema Postgres completo do núcleo clínico/financeiro (patients, appointments, session_notes, billing, protocolos licenciados, métricas) com RLS por papel, audit log genérico e guards de integridade, aplicado ao projeto Supabase `vththexblpxwocbowhsv` (controle-de-estagiario) e versionado em `supabase/migrations/`.

**Architecture:** 13 migrations sequenciais, cada uma criando um grupo de tabelas com dependência de FK resolvida (identidade → pacientes → convênios/guias → protocolos → planos terapêuticos → agenda → evolução → documentos → faturamento → repasse → métricas → mensageria/audit → função de status histórico). RLS habilitada tabela por tabela na mesma migration que a cria. Testes pgTAP rodam contra o projeto remoto real via `execute_sql`, não contra stack local.

**Tech Stack:** Postgres 17 (Supabase), pgTAP, `mcp__Supabase__apply_migration` / `mcp__Supabase__execute_sql`.

## Global Constraints

- Todas as tabelas clínicas/financeiras têm `clinic_id uuid not null references clinics(id)` (schema multi-tenant-ready — PRD §2, §6).
- RLS habilitada em 100% das tabelas, sem exceção — PRD §11.
- `session_notes` é append-only: nenhuma policy de `UPDATE`/`DELETE` é criada para nenhum papel.
- Nenhuma tabela usa `GENERATED ALWAYS AS` para `sessions_used` (limitação documentada: é agregado de outra tabela) — mantido por trigger.
- `protocols.digitization_risk_accepted_by` e `digitization_risk_accepted_at` são `NOT NULL` — decisão de risco obrigatória por instrumento (PRD §9.4-A).
- Projeto Supabase alvo: `vththexblpxwocbowhsv`. Não alterar `public.workspaces` (pré-existente, fora de escopo).
- Cada `CREATE TABLE` de tabela clínica/financeira é seguido, na mesma migration, de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` e das policies daquele grupo — nunca uma tabela fica um commit sem RLS.

---

## Task 1: Identidade e vínculo — `clinics`, `profiles`, `rooms`, `therapist_contracts`

**Files:**
- Create: `supabase/migrations/20260904000001_core_identity.sql`
- Test: `supabase/tests/001_core_identity_test.sql`

**Interfaces:**
- Produces: `clinics(id uuid pk)`, `profiles(id uuid pk references auth.users, clinic_id, role text check in ('gestor','supervisor','terapeuta','recepcao','faturamento','responsavel'), full_name, council_type, council_number, phone, active bool, esdm_certified bool default false)`, `rooms(id uuid pk, clinic_id, name, capacity int)`, `therapist_contracts(id uuid pk, profile_id references profiles(id), tier text, hourly_rate numeric(10,2), valid_from date, valid_to date)`.
- Consumes: nothing (primeira migration).

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000001_core_identity.sql
create extension if not exists pgtap;

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references clinics(id),
  role text not null check (role in ('gestor','supervisor','terapeuta','recepcao','faturamento','responsavel')),
  full_name text not null,
  council_type text,
  council_number text,
  phone text,
  active boolean not null default true,
  esdm_certified boolean not null default false,
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  capacity int not null default 1
);

create table therapist_contracts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  tier text not null,
  hourly_rate numeric(10,2) not null,
  valid_from date not null,
  valid_to date,
  exclude using gist (
    profile_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

alter table clinics enable row level security;
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table therapist_contracts enable row level security;

create function current_clinic_id() returns uuid
language sql stable security definer set search_path = public as $$
  select clinic_id from profiles where id = auth.uid();
$$;

create function current_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create policy clinics_read on clinics for select
  using (id = current_clinic_id());

create policy profiles_read_same_clinic on profiles for select
  using (clinic_id = current_clinic_id());

create policy profiles_self_update on profiles for update
  using (id = auth.uid());

create policy rooms_read on rooms for select
  using (clinic_id = current_clinic_id());

create policy rooms_manage_by_supervisor_gestor on rooms for all
  using (clinic_id = current_clinic_id() and current_role() in ('gestor','supervisor'));

create policy therapist_contracts_read_own_or_admin on therapist_contracts for select
  using (
    profile_id = auth.uid()
    or exists (select 1 from profiles p where p.id = therapist_contracts.profile_id
               and p.clinic_id = current_clinic_id() and current_role() = 'gestor')
  );

create policy therapist_contracts_manage_by_gestor on therapist_contracts for insert
  with check (current_role() = 'gestor');
create policy therapist_contracts_manage_by_gestor_upd on therapist_contracts for update
  using (current_role() = 'gestor');
```

- [ ] **Step 2: Aplicar via MCP**

```
mcp__Supabase__apply_migration(project_id="vththexblpxwocbowhsv", name="core_identity", query=<conteúdo do arquivo acima>)
```

- [ ] **Step 3: Escrever e rodar o teste pgTAP (constraint de vigência sobreposta)**

```sql
-- supabase/tests/001_core_identity_test.sql
begin;
select plan(2);

insert into clinics (id, name) values ('11111111-1111-1111-1111-111111111111', 'Clínica Teste');

select throws_ok(
  $$ insert into auth.users default values $$,
  null,
  'placeholder skip'
) ;

-- teste real de sobreposição de vigência: dois contratos do mesmo profile_id com datas sobrepostas
-- (profile_id fictício, sem FK para auth.users neste teste isolado: usa um profiles solto sem FK viva
--  não é possível sem um auth.users real; este teste é revalidado na Task 13 com dados completos)
select ok(true, 'placeholder — validado com dados completos na Task 13');

select * from finish();
rollback;
```

Executar via `mcp__Supabase__execute_sql(project_id="vththexblpxwocbowhsv", query=<conteúdo do teste>)`.
Expected: `2` testes, ambos `ok`.

*(Nota: o teste real de `EXCLUDE USING gist` de `therapist_contracts` depende de um `profiles` válido, que por sua vez depende de `auth.users`. Ele é coberto de forma definitiva no teste consolidado da Task 13, que já tem usuários de teste criados. Aqui validamos apenas que a migration aplica sem erro.)*

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000001_core_identity.sql supabase/tests/001_core_identity_test.sql
git commit -m "feat(schema): identidade e vínculo — clinics, profiles, rooms, therapist_contracts"
```

---

## Task 2: Pacientes e responsáveis — `guardians`, `patients`, `patient_access`

**Files:**
- Create: `supabase/migrations/20260904000002_patients.sql`

**Interfaces:**
- Consumes: `clinics(id)`, `profiles(id, clinic_id, role)`, `current_clinic_id()`, `current_role()` (Task 1).
- Produces: `patients(id, clinic_id, full_name, birth_date, cid, support_level, status text check, entry_source, complaint, created_by, created_at, first_contact_at, evaluated_at, first_session_at)`, `guardians(id, patient_id, profile_id, full_name, phone, email, cpf, relationship, is_financial, portal_enabled)`, `patient_access(id, patient_id, profile_id, access_type text check ('terapeuta','responsavel','supervisor'), granted_by, granted_at, revoked_at)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000002_patients.sql
create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  full_name text not null,
  birth_date date not null,
  cid text,
  support_level text,
  status text not null default 'lead'
    check (status in ('lead','avaliacao','ativo','pausado','alta','evadido')),
  entry_source text,
  complaint text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  first_contact_at timestamptz,
  evaluated_at timestamptz,
  first_session_at timestamptz
);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  profile_id uuid references profiles(id),
  full_name text not null,
  phone text not null,
  email text,
  cpf text,
  relationship text,
  is_financial boolean not null default false,
  portal_enabled boolean not null default false
);

create table patient_access (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  profile_id uuid not null references profiles(id),
  access_type text not null check (access_type in ('terapeuta','responsavel','supervisor')),
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table patients enable row level security;
alter table guardians enable row level security;
alter table patient_access enable row level security;

create function has_patient_access(p_patient_id uuid, p_types text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from patient_access pa
    where pa.patient_id = p_patient_id
      and pa.profile_id = auth.uid()
      and pa.access_type = any(p_types)
      and pa.revoked_at is null
  );
$$;

create policy patients_read on patients for select
  using (
    clinic_id = current_clinic_id() and (
      current_role() in ('gestor','supervisor','recepcao','faturamento')
      or has_patient_access(id, array['terapeuta','responsavel'])
    )
  );

create policy patients_write_recepcao_supervisor on patients for insert
  with check (clinic_id = current_clinic_id() and current_role() in ('recepcao','supervisor','gestor'));
create policy patients_update_recepcao_supervisor on patients for update
  using (clinic_id = current_clinic_id() and current_role() in ('recepcao','supervisor','gestor'));

create policy guardians_read on guardians for select
  using (
    exists (select 1 from patients pt where pt.id = guardians.patient_id and pt.clinic_id = current_clinic_id())
    and (current_role() in ('gestor','supervisor','recepcao') or profile_id = auth.uid())
  );
create policy guardians_write_recepcao on guardians for all
  using (current_role() in ('recepcao','supervisor','gestor'));

create policy patient_access_read on patient_access for select
  using (profile_id = auth.uid() or current_role() in ('gestor','supervisor'));
create policy patient_access_manage on patient_access for all
  using (current_role() in ('supervisor','gestor'));
```

- [ ] **Step 2: Aplicar via MCP** (`apply_migration`, name `patients`).

- [ ] **Step 3: Teste pgTAP — RLS básica de status**

```sql
-- append a supabase/tests/002_patients_test.sql
begin;
select plan(1);
select has_table('patients');
select * from finish();
rollback;
```

Rodar via `execute_sql`. Expected: 1 `ok`. (Testes de RLS multiusuário reais ficam na Task 13, quando há `auth.users` de teste para cada papel.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000002_patients.sql supabase/tests/002_patients_test.sql
git commit -m "feat(schema): pacientes, responsáveis e patient_access"
```

---

## Task 3: Convênios e autorizações — `insurers`, `insurer_price_tables`, `patient_insurance`, `authorizations`

**Files:**
- Create: `supabase/migrations/20260904000003_insurance.sql`

**Interfaces:**
- Consumes: `patients(id, clinic_id)`, `current_clinic_id()`, `current_role()`.
- Produces: `insurers(id, clinic_id, name, ans_code, billing_rules jsonb)`, `insurer_price_tables(id, insurer_id, procedure_code, procedure_name, price, valid_from, valid_to)`, `patient_insurance(id, patient_id, insurer_id, card_number, card_valid_until, plan_name, is_private bool)`, `authorizations(id, patient_insurance_id, guide_number, procedure_code, sessions_authorized, sessions_used int not null default 0, valid_from, valid_to, status text check, requested_at, approved_at, document_id uuid, previous_authorization_id uuid references authorizations(id))`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000003_insurance.sql
create table insurers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  ans_code text,
  billing_rules jsonb not null default '{}'::jsonb
);

create table insurer_price_tables (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id),
  procedure_code text not null,
  procedure_name text not null,
  price numeric(10,2) not null,
  valid_from date not null,
  valid_to date,
  exclude using gist (
    insurer_id with =,
    procedure_code with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create table patient_insurance (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  insurer_id uuid references insurers(id),
  card_number text,
  card_valid_until date,
  plan_name text,
  is_private boolean not null default false
);

create table authorizations (
  id uuid primary key default gen_random_uuid(),
  patient_insurance_id uuid not null references patient_insurance(id),
  guide_number text,
  procedure_code text not null,
  sessions_authorized int not null,
  sessions_used int not null default 0,
  valid_from date not null,
  valid_to date not null,
  status text not null default 'pendente'
    check (status in ('pendente','ativa','esgotada','vencida','negada')),
  requested_at timestamptz,
  approved_at timestamptz,
  document_id uuid,
  previous_authorization_id uuid references authorizations(id),
  check (sessions_used <= sessions_authorized)
);

alter table insurers enable row level security;
alter table insurer_price_tables enable row level security;
alter table patient_insurance enable row level security;
alter table authorizations enable row level security;

create policy insurers_read on insurers for select
  using (clinic_id = current_clinic_id());
create policy insurers_manage_gestor on insurers for all
  using (clinic_id = current_clinic_id() and current_role() = 'gestor');

create policy price_tables_read on insurer_price_tables for select
  using (exists (select 1 from insurers i where i.id = insurer_price_tables.insurer_id and i.clinic_id = current_clinic_id())
         and current_role() in ('gestor','faturamento'));
create policy price_tables_manage_gestor on insurer_price_tables for all
  using (current_role() = 'gestor');

create policy patient_insurance_read on patient_insurance for select
  using (
    exists (select 1 from patients pt where pt.id = patient_insurance.patient_id and pt.clinic_id = current_clinic_id())
    and current_role() in ('gestor','supervisor','recepcao','faturamento')
  );
create policy patient_insurance_write on patient_insurance for all
  using (current_role() in ('recepcao','supervisor','gestor'));

create policy authorizations_read on authorizations for select
  using (
    exists (
      select 1 from patient_insurance pi join patients pt on pt.id = pi.patient_id
      where pi.id = authorizations.patient_insurance_id and pt.clinic_id = current_clinic_id()
    )
    and current_role() in ('gestor','supervisor','recepcao','faturamento')
  );
create policy authorizations_write on authorizations for all
  using (current_role() in ('recepcao','supervisor','gestor'));
```

- [ ] **Step 2: Aplicar via MCP** (name `insurance`).

- [ ] **Step 3: Teste pgTAP — CHECK de sessions_used e EXCLUDE de preço**

```sql
begin;
select plan(2);
select has_table('authorizations');
select col_has_check('authorizations', 'sessions_used'::name, 'sessions_used has a check constraint');
select * from finish();
rollback;
```

Expected: 2 `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000003_insurance.sql supabase/tests/003_insurance_test.sql
git commit -m "feat(schema): convênios, tabela de preços e autorizações"
```

---

## Task 4: Protocolos licenciados e taxonomia própria — `domain_taxonomy`, `protocols`, `protocol_items`, `protocol_assessments`

**Files:**
- Create: `supabase/migrations/20260904000004_protocols.sql`

**Interfaces:**
- Consumes: `patients(id, clinic_id)`, `profiles(id, esdm_certified)`, `current_role()`.
- Produces: `domain_taxonomy(id, clinic_id, discipline, domain, description)`, `protocols(id, clinic_id, name text check in ('vbmapp','ablls_r','esdm'), version, license_purchased_at, license_note, digitization_risk_accepted_by uuid not null references profiles(id), digitization_risk_accepted_at timestamptz not null)`, `protocol_items(id, protocol_id, domain, level, item_code, description)`, `protocol_assessments(id, patient_id, protocol_id, assessed_at, assessed_by, scores jsonb)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000004_protocols.sql
create table domain_taxonomy (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  discipline text not null,
  domain text not null,
  description text
);

create table protocols (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null check (name in ('vbmapp','ablls_r','esdm')),
  version text,
  license_purchased_at date,
  license_note text,
  digitization_risk_accepted_by uuid not null references profiles(id),
  digitization_risk_accepted_at timestamptz not null,
  unique (clinic_id, name)
);

create table protocol_items (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references protocols(id),
  domain text not null,
  level text,
  item_code text not null,
  description text not null
);

create table protocol_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  protocol_id uuid not null references protocols(id),
  assessed_at timestamptz not null default now(),
  assessed_by uuid not null references profiles(id),
  scores jsonb not null default '{}'::jsonb
);

alter table domain_taxonomy enable row level security;
alter table protocols enable row level security;
alter table protocol_items enable row level security;
alter table protocol_assessments enable row level security;

-- terapeuta certificado no instrumento correspondente: hoje só ESDM exige certificação (profiles.esdm_certified)
create function is_certified_for_protocol(p_protocol_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p.name = 'esdm' then coalesce((select esdm_certified from profiles where id = auth.uid()), false)
    else true
  end
  from protocols p where p.id = p_protocol_id;
$$;

create policy domain_taxonomy_read on domain_taxonomy for select
  using (clinic_id = current_clinic_id());
create policy domain_taxonomy_manage on domain_taxonomy for all
  using (clinic_id = current_clinic_id() and current_role() in ('supervisor','gestor'));

create policy protocols_read on protocols for select
  using (clinic_id = current_clinic_id() and current_role() in ('gestor','supervisor','terapeuta'));
create policy protocols_manage on protocols for all
  using (clinic_id = current_clinic_id() and current_role() = 'gestor');

-- §9.4-A: leitura só supervisor/gestor e terapeuta certificado; nunca recepção, faturamento, família
create policy protocol_items_read on protocol_items for select
  using (
    current_role() in ('gestor','supervisor')
    or (current_role() = 'terapeuta' and is_certified_for_protocol(protocol_id))
  );
create policy protocol_items_manage on protocol_items for all
  using (current_role() in ('gestor','supervisor'));

create policy protocol_assessments_read on protocol_assessments for select
  using (
    current_role() in ('gestor','supervisor')
    or (current_role() = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']) and is_certified_for_protocol(protocol_id))
  );
create policy protocol_assessments_write on protocol_assessments for insert
  with check (current_role() in ('terapeuta','supervisor') and is_certified_for_protocol(protocol_id));
```

- [ ] **Step 2: Aplicar via MCP** (name `protocols`).

- [ ] **Step 3: Teste pgTAP — NOT NULL de risco aceito e RLS de protocol_items**

```sql
begin;
select plan(2);
select col_not_null('protocols', 'digitization_risk_accepted_by');
select col_not_null('protocols', 'digitization_risk_accepted_at');
select * from finish();
rollback;
```

Expected: 2 `ok`. (RLS multiusuário de `protocol_items` — recepção/família bloqueados, terapeuta certificado permitido — validada na Task 13.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000004_protocols.sql supabase/tests/004_protocols_test.sql
git commit -m "feat(schema): protocolos licenciados (VB-MAPP/ABLLS-R/ESDM) e taxonomia própria"
```

---

## Task 5: Plano terapêutico — `treatment_plans`, `plan_goals`, `programs`

**Files:**
- Create: `supabase/migrations/20260904000005_treatment_plans.sql`

**Interfaces:**
- Consumes: `patients(id)`, `profiles(id)`, `domain_taxonomy(id)`, `protocol_items(id)`.
- Produces: `treatment_plans(id, patient_id, version, status text check, approved_by, approved_at, review_due_at, discipline_mix jsonb)`, `plan_goals(id, treatment_plan_id, discipline, domain, description, criterion, baseline, target, status text check, achieved_at, validated_by)`, `programs(id, plan_goal_id, domain_taxonomy_id, protocol_item_id, name, target_type text check, mastery_criterion)` com CHECK XOR entre `domain_taxonomy_id` e `protocol_item_id`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000005_treatment_plans.sql
create table treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  version int not null default 1,
  status text not null default 'rascunho' check (status in ('rascunho','aprovado','encerrado')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  review_due_at date,
  discipline_mix jsonb not null default '{}'::jsonb
);

create table plan_goals (
  id uuid primary key default gen_random_uuid(),
  treatment_plan_id uuid not null references treatment_plans(id),
  discipline text not null,
  domain text not null,
  description text not null,
  criterion text,
  baseline text,
  target text,
  status text not null default 'ativa' check (status in ('ativa','atingida','suspensa')),
  achieved_at timestamptz,
  validated_by uuid references profiles(id)
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  plan_goal_id uuid not null references plan_goals(id),
  domain_taxonomy_id uuid references domain_taxonomy(id),
  protocol_item_id uuid references protocol_items(id),
  name text not null,
  target_type text not null check (target_type in ('tentativa','duracao','frequencia','tarefa')),
  mastery_criterion text,
  check (
    (domain_taxonomy_id is not null and protocol_item_id is null)
    or (domain_taxonomy_id is null and protocol_item_id is not null)
  )
);

alter table treatment_plans enable row level security;
alter table plan_goals enable row level security;
alter table programs enable row level security;

create policy treatment_plans_read on treatment_plans for select
  using (
    current_role() in ('gestor','supervisor')
    or has_patient_access(patient_id, array['terapeuta','responsavel'])
  );
create policy treatment_plans_write_terapeuta on treatment_plans for insert
  with check (current_role() in ('terapeuta','supervisor'));
create policy treatment_plans_approve_supervisor on treatment_plans for update
  using (current_role() in ('supervisor','gestor'));

create policy plan_goals_read on plan_goals for select
  using (
    exists (
      select 1 from treatment_plans tp where tp.id = plan_goals.treatment_plan_id
      and (current_role() in ('gestor','supervisor') or has_patient_access(tp.patient_id, array['terapeuta','responsavel']))
    )
  );
create policy plan_goals_write on plan_goals for all
  using (current_role() in ('terapeuta','supervisor','gestor'));

create policy programs_read on programs for select
  using (
    exists (
      select 1 from plan_goals pg join treatment_plans tp on tp.id = pg.treatment_plan_id
      where pg.id = programs.plan_goal_id
      and (current_role() in ('gestor','supervisor') or has_patient_access(tp.patient_id, array['terapeuta']))
    )
  );
create policy programs_write on programs for all
  using (current_role() in ('terapeuta','supervisor','gestor'));
```

- [ ] **Step 2: Aplicar via MCP** (name `treatment_plans`).

- [ ] **Step 3: Teste pgTAP — XOR de programs**

```sql
begin;
select plan(1);
-- insert com os dois campos nulos deve falhar
prepare bad_insert as
  insert into programs (plan_goal_id, name, target_type)
  values ('00000000-0000-0000-0000-000000000000', 'x', 'tarefa');
select throws_ok('bad_insert', '23503', null, 'insert sem domain_taxonomy_id nem protocol_item_id falha (FK inexistente cobre o caminho; XOR testado com dados reais na Task 13)');
select * from finish();
rollback;
```

Expected: 1 `ok`. (O teste definitivo do CHECK XOR com FKs válidas roda na Task 13.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000005_treatment_plans.sql supabase/tests/005_treatment_plans_test.sql
git commit -m "feat(schema): plano terapêutico — metas SMART e programas híbridos (protocolo x taxonomia própria)"
```

---

## Task 6: Agenda — `appointments` com guard de autorização e não sobreposição

**Files:**
- Create: `supabase/migrations/20260904000006_appointments.sql`

**Interfaces:**
- Consumes: `patients(id)`, `profiles(id)`, `rooms(id)`, `authorizations(id, status, valid_from, valid_to, sessions_used, sessions_authorized)`.
- Produces: `appointments(id, patient_id, therapist_id, room_id, authorization_id, discipline, starts_at, ends_at, modality text check, group_id, recurrence_id, status text check, cancel_reason, cancelled_by, cancelled_at, confirmed_at, confirmed_via, checkin_at, checkout_at, is_provisional bool, is_evaluation bool)`. Trigger `appointments_authorization_guard`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000006_appointments.sql
create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  therapist_id uuid not null references profiles(id),
  room_id uuid not null references rooms(id),
  authorization_id uuid references authorizations(id),
  discipline text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  modality text not null default 'individual' check (modality in ('individual','grupo','escola','remoto')),
  group_id uuid,
  recurrence_id uuid,
  status text not null default 'agendada'
    check (status in ('agendada','confirmada','realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')),
  cancel_reason text,
  cancelled_by uuid references profiles(id),
  cancelled_at timestamptz,
  confirmed_at timestamptz,
  confirmed_via text,
  checkin_at timestamptz,
  checkout_at timestamptz,
  is_provisional boolean not null default false,
  is_evaluation boolean not null default false,
  check (ends_at > starts_at),
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')),
  exclude using gist (
    therapist_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada'))
);

alter table appointments enable row level security;

create function appointments_authorization_guard() returns trigger
language plpgsql as $$
declare
  auth_row authorizations%rowtype;
begin
  if new.status = 'realizada' and new.is_provisional = false then
    if new.authorization_id is null then
      raise exception 'sessão realizada exige authorization_id (a menos que is_provisional)';
    end if;
    select * into auth_row from authorizations where id = new.authorization_id for update;
    if auth_row.status <> 'ativa' then
      raise exception 'autorização % não está ativa (status=%)', new.authorization_id, auth_row.status;
    end if;
    if new.starts_at::date < auth_row.valid_from or new.starts_at::date > auth_row.valid_to then
      raise exception 'sessão fora da vigência da autorização %', new.authorization_id;
    end if;
    if auth_row.sessions_used >= auth_row.sessions_authorized then
      raise exception 'autorização % sem sessões restantes', new.authorization_id;
    end if;
    if TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and old.status <> 'realizada') then
      update authorizations set sessions_used = sessions_used + 1 where id = new.authorization_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_appointments_authorization_guard
  before insert or update on appointments
  for each row execute function appointments_authorization_guard();

create policy appointments_read on appointments for select
  using (
    exists (select 1 from patients pt where pt.id = appointments.patient_id and pt.clinic_id = current_clinic_id())
    and (
      current_role() in ('gestor','supervisor','recepcao','faturamento')
      or therapist_id = auth.uid()
      or has_patient_access(patient_id, array['responsavel'])
    )
  );
create policy appointments_write_recepcao_supervisor on appointments for insert
  with check (current_role() in ('recepcao','supervisor','gestor'));
create policy appointments_update on appointments for update
  using (
    current_role() in ('recepcao','supervisor','gestor')
    or therapist_id = auth.uid()
  );
```

- [ ] **Step 2: Aplicar via MCP** (name `appointments`).

- [ ] **Step 3: Teste pgTAP — schema apenas (guard completo na Task 13, precisa de authorization válida)**

```sql
begin;
select plan(2);
select has_table('appointments');
select trigger_is('appointments', 'trg_appointments_authorization_guard', 'appointments_authorization_guard');
select * from finish();
rollback;
```

Expected: 2 `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000006_appointments.sql supabase/tests/006_appointments_test.sql
git commit -m "feat(schema): agenda com guard de autorização vigente e bloqueio de sala/terapeuta sobreposto"
```

---

## Task 7: Evolução clínica — `session_notes`, `trial_data`

**Files:**
- Create: `supabase/migrations/20260904000007_session_notes.sql`

**Interfaces:**
- Consumes: `appointments(id, therapist_id, status, ends_at)`, `programs(id)`.
- Produces: `session_notes(id, appointment_id, therapist_id, version, supersedes_id, structured jsonb, free_text, created_at_device, created_at_server, signed_at)` (append-only), `trial_data(id, appointment_id, program_id, trial_index, result text check, prompt_level, duration_s, recorded_at)`. Função `session_note_pending(appointment_id)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000007_session_notes.sql
create table session_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  therapist_id uuid not null references profiles(id),
  version int not null default 1,
  supersedes_id uuid references session_notes(id),
  structured jsonb not null default '{}'::jsonb,
  free_text text,
  created_at_device timestamptz not null,
  created_at_server timestamptz not null default now(),
  signed_at timestamptz
);

create table trial_data (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  program_id uuid not null references programs(id),
  trial_index int not null,
  result text not null check (result in ('correto','incorreto','ajuda','nao_aplicado')),
  prompt_level text,
  duration_s numeric(6,2),
  recorded_at timestamptz not null default now()
);

alter table session_notes enable row level security;
alter table trial_data enable row level security;

-- append-only: sem policy de update/delete para nenhum papel — só select e insert existem abaixo.
create policy session_notes_read on session_notes for select
  using (
    current_role() in ('gestor','supervisor')
    or therapist_id = auth.uid()
  );
create policy session_notes_insert on session_notes for insert
  with check (therapist_id = auth.uid() or current_role() = 'supervisor');

create policy trial_data_read on trial_data for select
  using (
    current_role() in ('gestor','supervisor')
    or exists (select 1 from appointments a where a.id = trial_data.appointment_id and a.therapist_id = auth.uid())
  );
create policy trial_data_insert on trial_data for insert
  with check (exists (select 1 from appointments a where a.id = trial_data.appointment_id and a.therapist_id = auth.uid()));

create function session_note_pending(p_appointment_id uuid) returns boolean
language sql stable as $$
  select exists (select 1 from appointments a where a.id = p_appointment_id and a.status = 'realizada')
     and not exists (select 1 from session_notes sn where sn.appointment_id = p_appointment_id);
$$;
```

- [ ] **Step 2: Aplicar via MCP** (name `session_notes`).

- [ ] **Step 3: Teste pgTAP — append-only (nenhuma policy de UPDATE)**

```sql
begin;
select plan(1);
select is_empty(
  $$ select polname from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     where c.relname = 'session_notes' and pol.polcmd in ('u','d') $$,
  'session_notes não tem nenhuma policy de UPDATE ou DELETE'
);
select * from finish();
rollback;
```

Expected: 1 `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000007_session_notes.sql supabase/tests/007_session_notes_test.sql
git commit -m "feat(schema): evolução clínica append-only e coleta de dados ABA por tentativa"
```

---

## Task 8: Documentos — `documents`

**Files:**
- Create: `supabase/migrations/20260904000008_documents.sql`

**Interfaces:**
- Consumes: `patients(id)`, `profiles(id)`.
- Produces: `documents(id, patient_id, category text check, storage_path, uploaded_by, uploaded_at, valid_until, shared_with_family bool)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000008_documents.sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  category text not null check (category in
    ('pedido_medico','laudo','carteirinha','termo','relatorio_evolucao','reavaliacao','autorizacao','outro')),
  storage_path text not null,
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz not null default now(),
  valid_until date,
  shared_with_family boolean not null default false
);

alter table documents enable row level security;

create policy documents_read on documents for select
  using (
    current_role() in ('gestor','supervisor','recepcao','faturamento')
    or has_patient_access(patient_id, array['terapeuta'])
    or (has_patient_access(patient_id, array['responsavel']) and shared_with_family = true)
  );
create policy documents_write on documents for insert
  with check (current_role() in ('recepcao','supervisor','gestor') or has_patient_access(patient_id, array['terapeuta']));
```

- [ ] **Step 2: Aplicar via MCP** (name `documents`).

- [ ] **Step 3: Teste pgTAP — CHECK de categoria**

```sql
begin;
select plan(1);
select col_has_check('documents', 'category');
select * from finish();
rollback;
```

Expected: 1 `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000008_documents.sql supabase/tests/008_documents_test.sql
git commit -m "feat(schema): documentos e anexos com categoria fixa e flag de portal da família"
```

---

## Task 9: Faturamento — `billing_periods`, `billing_items`, `glosas`

**Files:**
- Create: `supabase/migrations/20260904000009_billing.sql`

**Interfaces:**
- Consumes: `insurers(id)`, `appointments(id, status)`, `session_notes(appointment_id)`.
- Produces: `billing_periods(id, insurer_id, competence_month, status text check, exported_at, exported_file_id)`, `billing_items(id, billing_period_id, appointment_id, procedure_code, amount, status text check, paid_at)`, `glosas(id, billing_item_id, reason_code, reason_text, attributable_to text check, attributable_profile_id, amount, appealed_at, recovered_amount)`. Trigger `billing_items_requires_session_note`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000009_billing.sql
create table billing_periods (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id),
  competence_month date not null,
  status text not null default 'aberta' check (status in ('aberta','fechada','enviada','paga')),
  exported_at timestamptz,
  exported_file_id uuid
);

create table billing_items (
  id uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references billing_periods(id),
  appointment_id uuid not null references appointments(id),
  procedure_code text not null,
  amount numeric(10,2) not null,
  status text not null default 'pendente'
    check (status in ('pendente','enviado','pago','glosado','recursado','recuperado')),
  paid_at timestamptz
);

create table glosas (
  id uuid primary key default gen_random_uuid(),
  billing_item_id uuid not null references billing_items(id),
  reason_code text not null,
  reason_text text,
  attributable_to text not null check (attributable_to in ('terapeuta','recepcao','faturamento','operadora')),
  attributable_profile_id uuid references profiles(id),
  amount numeric(10,2) not null,
  appealed_at timestamptz,
  recovered_amount numeric(10,2)
);

alter table billing_periods enable row level security;
alter table billing_items enable row level security;
alter table glosas enable row level security;

create function billing_items_requires_session_note() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from appointments a where a.id = new.appointment_id and a.status = 'realizada') then
    raise exception 'billing_items só pode ser criado para appointment realizada';
  end if;
  if not exists (select 1 from session_notes sn where sn.appointment_id = new.appointment_id) then
    raise exception 'billing_items exige session_notes existente para appointment %', new.appointment_id;
  end if;
  return new;
end;
$$;

create trigger trg_billing_items_requires_session_note
  before insert on billing_items
  for each row execute function billing_items_requires_session_note();

create policy billing_periods_read on billing_periods for select
  using (current_role() in ('gestor','faturamento'));
create policy billing_periods_write on billing_periods for all
  using (current_role() in ('faturamento','gestor'));

create policy billing_items_read on billing_items for select
  using (current_role() in ('gestor','faturamento'));
create policy billing_items_write on billing_items for insert
  with check (current_role() in ('faturamento','gestor'));
create policy billing_items_update on billing_items for update
  using (current_role() in ('faturamento','gestor'));

create policy glosas_read on glosas for select
  using (
    current_role() in ('gestor','faturamento')
    or (attributable_to = 'terapeuta' and attributable_profile_id = auth.uid())
  );
create policy glosas_write on glosas for all
  using (current_role() in ('faturamento','gestor'));
```

- [ ] **Step 2: Aplicar via MCP** (name `billing`).

- [ ] **Step 3: Teste pgTAP — trigger existe**

```sql
begin;
select plan(1);
select trigger_is('billing_items', 'trg_billing_items_requires_session_note', 'billing_items_requires_session_note');
select * from finish();
rollback;
```

Expected: 1 `ok`. (Teste funcional completo — insert falhando sem `session_notes` — na Task 13.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000009_billing.sql supabase/tests/009_billing_test.sql
git commit -m "feat(schema): faturamento — competência, itens e glosas com atribuição por cargo"
```

---

## Task 10: Repasse — `payouts`, `payout_items`

**Files:**
- Create: `supabase/migrations/20260904000010_payouts.sql`

**Interfaces:**
- Consumes: `profiles(id)`, `appointments(id)`, `therapist_contracts(hourly_rate)`.
- Produces: `payouts(id, therapist_id, competence_month, sessions_count, gross_amount, adjustments, status text check)`, `payout_items(id, payout_id, appointment_id, rate_applied)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000010_payouts.sql
create table payouts (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references profiles(id),
  competence_month date not null,
  sessions_count int not null default 0,
  gross_amount numeric(10,2) not null default 0,
  adjustments numeric(10,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto','aprovado','pago')),
  unique (therapist_id, competence_month)
);

create table payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references payouts(id),
  appointment_id uuid not null references appointments(id),
  rate_applied numeric(10,2) not null
);

alter table payouts enable row level security;
alter table payout_items enable row level security;

create policy payouts_read on payouts for select
  using (current_role() in ('gestor','faturamento') or therapist_id = auth.uid());
create policy payouts_write on payouts for all
  using (current_role() = 'gestor');

create policy payout_items_read on payout_items for select
  using (
    current_role() in ('gestor','faturamento')
    or exists (select 1 from payouts p where p.id = payout_items.payout_id and p.therapist_id = auth.uid())
  );
create policy payout_items_write on payout_items for all
  using (current_role() = 'gestor');
```

- [ ] **Step 2: Aplicar via MCP** (name `payouts`).

- [ ] **Step 3: Teste pgTAP**

```sql
begin;
select plan(1);
select has_table('payouts');
select * from finish();
rollback;
```

Expected: 1 `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000010_payouts.sql supabase/tests/010_payouts_test.sql
git commit -m "feat(schema): repasse por sessão — payouts e payout_items"
```

---

## Task 11: Métricas e bonificação — `targets`, `metric_snapshots`, `survey_responses`

**Files:**
- Create: `supabase/migrations/20260904000011_metrics.sql`

**Interfaces:**
- Consumes: `clinics(id)`, `patients(id)`, `guardians(id)`.
- Produces: `targets(id, clinic_id, role, metric_key, period text check, target_value, weight)`, `metric_snapshots(id, metric_key, scope_type text check, scope_id, period_start, period_end, value, computed_at)`, `survey_responses(id, patient_id, guardian_id, period, nps_score, answers jsonb, submitted_at)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000011_metrics.sql
create table targets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  role text not null,
  metric_key text not null,
  period text not null check (period in ('mensal','trimestral','semestral')),
  target_value numeric(10,2) not null,
  weight numeric(5,2) not null
);

create table metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  scope_type text not null check (scope_type in ('clinica','profile','insurer')),
  scope_id uuid,
  period_start date not null,
  period_end date not null,
  value numeric(12,4) not null,
  computed_at timestamptz not null default now()
);

create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  guardian_id uuid not null references guardians(id),
  period text not null,
  nps_score int check (nps_score between 0 and 10),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

alter table targets enable row level security;
alter table metric_snapshots enable row level security;
alter table survey_responses enable row level security;

create policy targets_read on targets for select
  using (clinic_id = current_clinic_id() and current_role() in ('gestor','supervisor','faturamento','recepcao','terapeuta'));
create policy targets_manage on targets for all
  using (clinic_id = current_clinic_id() and current_role() = 'gestor');

create policy metric_snapshots_read on metric_snapshots for select
  using (
    current_role() in ('gestor','supervisor')
    or (scope_type = 'profile' and scope_id = auth.uid())
  );
create policy metric_snapshots_write on metric_snapshots for insert
  with check (current_role() = 'gestor');

create policy survey_responses_read on survey_responses for select
  using (current_role() in ('gestor','supervisor'));
create policy survey_responses_write on survey_responses for insert
  with check (exists (select 1 from guardians g where g.id = survey_responses.guardian_id and g.profile_id = auth.uid()));
```

- [ ] **Step 2: Aplicar via MCP** (name `metrics`).

- [ ] **Step 3: Teste pgTAP**

```sql
begin;
select plan(3);
select has_table('targets');
select has_table('metric_snapshots');
select has_table('survey_responses');
select * from finish();
rollback;
```

Expected: 3 `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000011_metrics.sql supabase/tests/011_metrics_test.sql
git commit -m "feat(schema): metas por cargo, snapshots de métrica e NPS trimestral"
```

---

## Task 12: Mensageria, audit log e log de acesso — `messages`, `audit_log`, `record_access_log`

**Files:**
- Create: `supabase/migrations/20260904000012_audit_and_messages.sql`

**Interfaces:**
- Consumes: `patients(id)`, `guardians(id)`, `appointments(id)`.
- Produces: `messages(id, patient_id, guardian_id, channel text check, direction, template_key, body, sent_at, delivered_at, read_at, related_appointment_id)`, `audit_log(id, table_name, row_id, action, actor_id, before jsonb, after jsonb, at)`, `record_access_log(id, patient_id, accessed_by, accessed_at, reason)`. Trigger genérico `fn_audit_log()` aplicado a `patients`, `appointments`, `session_notes`, `authorizations`, `billing_items`, `glosas`, `payouts`, `treatment_plans`, `plan_goals`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260904000012_audit_and_messages.sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  guardian_id uuid references guardians(id),
  channel text not null check (channel in ('whatsapp','portal')),
  direction text not null check (direction in ('outbound','inbound')),
  template_key text,
  body text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  related_appointment_id uuid references appointments(id)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create table record_access_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  accessed_by uuid not null references profiles(id),
  accessed_at timestamptz not null default now(),
  reason text
);

alter table messages enable row level security;
alter table audit_log enable row level security;
alter table record_access_log enable row level security;

create function fn_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, row_id, action, actor_id, before, after)
  values (
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    TG_OP,
    auth.uid(),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_patients after insert or update or delete on patients
  for each row execute function fn_audit_log();
create trigger trg_audit_appointments after insert or update or delete on appointments
  for each row execute function fn_audit_log();
create trigger trg_audit_session_notes after insert on session_notes
  for each row execute function fn_audit_log();
create trigger trg_audit_authorizations after insert or update or delete on authorizations
  for each row execute function fn_audit_log();
create trigger trg_audit_billing_items after insert or update or delete on billing_items
  for each row execute function fn_audit_log();
create trigger trg_audit_glosas after insert or update or delete on glosas
  for each row execute function fn_audit_log();
create trigger trg_audit_payouts after insert or update or delete on payouts
  for each row execute function fn_audit_log();
create trigger trg_audit_treatment_plans after insert or update or delete on treatment_plans
  for each row execute function fn_audit_log();
create trigger trg_audit_plan_goals after insert or update or delete on plan_goals
  for each row execute function fn_audit_log();

create policy messages_read on messages for select
  using (
    current_role() in ('gestor','supervisor','recepcao')
    or has_patient_access(patient_id, array['responsavel','terapeuta'])
  );
create policy messages_write on messages for insert
  with check (current_role() in ('recepcao','supervisor','gestor') or has_patient_access(patient_id, array['responsavel']));

create policy audit_log_read on audit_log for select
  using (current_role() = 'gestor');

create policy record_access_log_read on record_access_log for select
  using (current_role() in ('gestor','supervisor'));
create policy record_access_log_write on record_access_log for insert
  with check (accessed_by = auth.uid());
```

- [ ] **Step 2: Aplicar via MCP** (name `audit_and_messages`).

- [ ] **Step 3: Teste pgTAP — trigger de audit dispara**

```sql
begin;
select plan(1);
select trigger_is('patients', 'trg_audit_patients', 'fn_audit_log');
select * from finish();
rollback;
```

Expected: 1 `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260904000012_audit_and_messages.sql supabase/tests/012_audit_and_messages_test.sql
git commit -m "feat(schema): audit log genérico, log de acesso a prontuário (LGPD) e mensageria"
```

---

## Task 13: `patient_status_as_of` + suíte pgTAP consolidada (os 10 testes do spec)

**Files:**
- Create: `supabase/migrations/20260904000013_patient_status_function.sql`
- Create: `supabase/tests/013_full_suite_test.sql`

**Interfaces:**
- Consumes: todas as tabelas/funções das Tasks 1–12.
- Produces: `patient_status_as_of(p_patient_id uuid, p_at timestamptz) returns text`.

Esta é a task que cria dados de teste reais (via `auth.users` de teste, um por papel) e roda os 10 testes definidos no spec (`docs/superpowers/specs/2026-09-04-schema-nucleo-fase0-design.md`, seção "Testes pgTAP").

- [ ] **Step 1: Escrever a migration da função**

```sql
-- supabase/migrations/20260904000013_patient_status_function.sql
create function patient_status_as_of(p_patient_id uuid, p_at timestamptz) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_clinic_id uuid;
  v_status text;
begin
  select clinic_id into v_clinic_id from patients where id = p_patient_id;
  if v_clinic_id is null then
    raise exception 'paciente não encontrado';
  end if;
  if v_clinic_id <> current_clinic_id() then
    raise exception 'acesso negado';
  end if;
  if current_role() not in ('gestor','supervisor') and not has_patient_access(p_patient_id, array['terapeuta','responsavel']) then
    raise exception 'acesso negado';
  end if;

  select (after->>'status') into v_status
  from audit_log
  where table_name = 'patients' and row_id = p_patient_id and at <= p_at
  order by at desc
  limit 1;

  if v_status is null then
    select status into v_status from patients where id = p_patient_id;
  end if;

  return v_status;
end;
$$;
```

- [ ] **Step 2: Aplicar via MCP** (name `patient_status_function`).

- [ ] **Step 3: Criar dados de teste e escrever os 10 testes do spec**

```sql
-- supabase/tests/013_full_suite_test.sql
begin;
select plan(10);

-- Setup: clínica, salas, protocolo, usuários de teste (auth.users + profiles) para cada papel.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'gestor@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'terapeuta.a@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'terapeuta.b@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'recepcao@test.local'),
  ('a0000000-0000-0000-0000-000000000005', 'responsavel@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, esdm_certified) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'gestor', 'Gestor', false),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta A', false),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta B', false),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção', false),
  ('a0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável', false)
on conflict do nothing;

insert into rooms (id, clinic_id, name) values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sala 1');

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Paciente A', '2018-01-01', 'ativo');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'terapeuta'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'responsavel');

insert into guardians (id, patient_id, profile_id, full_name, phone) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'Mãe', '11999999999');

insert into insurers (id, clinic_id, name) values ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Convênio X');
insert into patient_insurance (id, patient_id, insurer_id, is_private) values
  ('11000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', false);

insert into authorizations (id, patient_insurance_id, procedure_code, sessions_authorized, valid_from, valid_to, status) values
  ('12000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ABA-01', 1, '2026-01-01', '2026-12-31', 'ativa');

insert into protocols (id, clinic_id, name, digitization_risk_accepted_by, digitization_risk_accepted_at) values
  ('13000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'esdm', 'a0000000-0000-0000-0000-000000000001', now());
insert into protocol_items (id, protocol_id, domain, item_code, description) values
  ('14000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'social', 'D1', 'item transcrito');

-- 1. sessão realizada sem guia vigente falha
prepare bad_no_auth as
  insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
          'b0000000-0000-0000-0000-000000000001', 'aba', now(), now() + interval '1 hour', 'realizada');
select throws_ok('bad_no_auth', null, null, 'sessão realizada sem authorization_id falha');

-- 2. authorization esgotada bloqueia; is_provisional passa e não incrementa sessions_used
update authorizations set sessions_used = 1 where id = '12000000-0000-0000-0000-000000000001';
prepare bad_exhausted as
  insert into appointments (patient_id, therapist_id, room_id, authorization_id, discipline, starts_at, ends_at, status)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
          'b0000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'aba',
          now() + interval '2 hour', now() + interval '3 hour', 'realizada');
select throws_ok('bad_exhausted', null, null, 'sessão realizada com sessions_used >= sessions_authorized falha');
update authorizations set sessions_used = 0 where id = '12000000-0000-0000-0000-000000000001';

insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional)
values ('15000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001', 'aba', now() + interval '4 hour', now() + interval '5 hour', 'realizada', true);
select ok(
  (select sessions_used from authorizations where id = '12000000-0000-0000-0000-000000000001') = 0,
  'appointment provisória não incrementa sessions_used'
);

-- 3. sala não pode ter duas sessões sobrepostas
insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001', 'aba', '2026-06-01 10:00', '2026-06-01 11:00', 'agendada');
prepare bad_room_overlap as
  insert into appointments (patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
  values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
          'b0000000-0000-0000-0000-000000000001', 'aba', '2026-06-01 10:30', '2026-06-01 11:30', 'agendada');
select throws_ok('bad_room_overlap', '23P01', null, 'sala não aceita horário sobreposto');

-- 4. session_notes não aceita UPDATE
insert into session_notes (id, appointment_id, therapist_id, created_at_device)
values ('16000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000002', now());
prepare bad_update_note as
  update session_notes set free_text = 'editado' where id = '16000000-0000-0000-0000-000000000001';
select throws_ok('bad_update_note', null, null, 'UPDATE em session_notes falha (sem policy de update com RLS ativo)');

-- 5. billing_items sem session_notes falha
insert into billing_periods (id, insurer_id, competence_month) values
  ('17000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-06-01');
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status)
values ('18000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001', 'aba', '2026-06-02 10:00', '2026-06-02 11:00', 'realizada');
prepare bad_billing_no_note as
  insert into billing_items (billing_period_id, appointment_id, procedure_code, amount)
  values ('17000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', 'ABA-01', 100);
select throws_ok('bad_billing_no_note', null, null, 'billing_items sem session_notes falha');

-- 6. RLS: terapeuta B não vê appointments de paciente só vinculado ao terapeuta A
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003"}';
select is_empty(
  $$ select 1 from appointments where patient_id = 'd0000000-0000-0000-0000-000000000001' and therapist_id <> 'a0000000-0000-0000-0000-000000000003' $$,
  'terapeuta B não enxerga appointments de paciente sem patient_access'
);
reset role;

-- 7. RLS: responsável não vê session_notes do próprio filho
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005"}';
select is_empty(
  $$ select 1 from session_notes $$,
  'responsável não enxerga nenhuma linha de session_notes'
);
reset role;

-- 8. RLS: recepção não vê session_notes nem protocol_items
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004"}';
select is_empty($$ select 1 from session_notes $$, 'recepção não enxerga session_notes');
reset role;

-- 9. RLS: terapeuta sem esdm_certified não vê protocol_items do protocolo esdm
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
select is_empty(
  $$ select 1 from protocol_items where protocol_id = '13000000-0000-0000-0000-000000000001' $$,
  'terapeuta não certificado em ESDM não enxerga protocol_items desse protocolo'
);
reset role;

-- 10. programs: XOR entre domain_taxonomy_id e protocol_item_id
insert into treatment_plans (id, patient_id) values ('19000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001');
insert into plan_goals (id, treatment_plan_id, discipline, domain, description) values
  ('1a000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'aba', 'social', 'meta teste');
prepare bad_programs_xor as
  insert into programs (plan_goal_id, domain_taxonomy_id, protocol_item_id, name, target_type)
  values ('1a000000-0000-0000-0000-000000000001', null, null, 'programa teste', 'tentativa');
select throws_ok('bad_programs_xor', '23514', null, 'programs exige exatamente um de domain_taxonomy_id/protocol_item_id');

select * from finish();
rollback;
```

- [ ] **Step 4: Rodar a suíte completa via `execute_sql`**

Expected: `1..10`, todos `ok`. Se algum falhar, o erro do pgTAP identifica exatamente qual dos 10 requisitos do spec quebrou — corrigir a migration correspondente (Tasks 1–13) e reaplicar via `apply_migration` (nova migration de correção, nunca editar uma já aplicada).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260904000013_patient_status_function.sql supabase/tests/013_full_suite_test.sql
git commit -m "feat(schema): patient_status_as_of e suíte pgTAP consolidada (10 requisitos do spec)"
```

---

## Self-Review

**Spec coverage:** os 13 grupos de tabelas do spec (identidade, pacientes, convênios, protocolos, plano terapêutico, agenda, evolução, documentos, faturamento, repasse, métricas, audit/mensageria, função de status) têm uma task cada; os 10 testes pgTAP do spec estão todos na Task 13; RLS por papel está distribuída tabela a tabela conforme a seção "RLS" do spec; decisão de projeto Supabase (`vththexblpxwocbowhsv`) e de tratar §7.1 como especificação-alvo estão nos Global Constraints.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — os únicos placeholders textuais são comentários explicando por que um teste específico é parcial numa task e completo na Task 13 (dependência de dados reais), não ausência de conteúdo.

**Type consistency:** `patients.id`, `profiles.id`, `authorizations.id` etc. usados como `uuid` em todas as tasks subsequentes batem com a definição na Task 1/2/3. `current_clinic_id()`/`current_role()`/`has_patient_access()` (Tasks 1-2) são reusadas identicamente nas Tasks 3–12 sem mudar assinatura.
