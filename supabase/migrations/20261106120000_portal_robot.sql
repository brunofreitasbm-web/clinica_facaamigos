-- Robô de autorização no portal do plano (etapa 2 da linha do tempo de Autorizações).
--
-- Hoje a etapa "Guia enviada ao plano" é manual: alguém sai do sistema, entra no
-- portal do convênio (ex.: Conecta Saúde/IASEP), preenche os 5 passos da guia
-- SP/SADT, anexa o laudo e volta para marcar aqui. Com o robô, a recepção pede o
-- envio pelo próprio cartão da etapa 2 e um AGENTE instalado num computador da
-- clínica (Python + Playwright, fora da Vercel) faz o preenchimento no portal.
--
-- Fluxo de um pedido (portal_robot_jobs.status):
--   na_fila → em_andamento → aguardando_confirmacao → confirmado → enviado
--                       ↘ erro (nada foi enviado)        ↘ verificar (clicou em Autorizar mas
--   modo "simular": … → simulado (para no resumo)          não leu o resultado: conferir no portal)
--   cancelado: a recepção desistiu antes da confirmação.
--
-- Quem fala com o banco do lado do agente são as rotas /api/portal-robot/* (service
-- role), autenticadas por token do agente (portal_robot_agents.token_hash). A
-- senha do portal NUNCA passa pelo CRM: fica só no computador do agente.

-- Agentes instalados (um por computador). O token em texto só existe no .env do
-- agente; aqui fica o SHA-256. Cadastro pelo SQL editor (ver docs/portal-robot.md).
create table portal_robot_agents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_version text
);

create index portal_robot_agents_clinic_idx on portal_robot_agents (clinic_id);

-- Médicos solicitantes já usados (quem assina o laudo), para a recepção não
-- redigitar nome/conselho/registro/UF/CBO a cada pedido.
create table portal_robot_professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  council text not null default 'CRM',
  register text not null,
  uf text,
  cbo text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, council, register)
);

create index portal_robot_professionals_clinic_idx on portal_robot_professionals (clinic_id);

create table portal_robot_jobs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  draft_id uuid not null references registration_drafts(id) on delete cascade,
  portal text not null default 'conecta_iasep',
  mode text not null default 'autorizar' check (mode in ('simular', 'autorizar')),
  status text not null default 'na_fila'
    check (status in ('na_fila', 'em_andamento', 'aguardando_confirmacao', 'confirmado',
                      'enviado', 'simulado', 'erro', 'verificar', 'cancelado')),
  step int not null default 0,
  step_label text,
  -- Foto do pedido no momento do envio (o agente usa só isto):
  -- { patient_name, card_number, cid, reference_month, observation,
  --   professional: {name, council, register, uf, cbo},
  --   procedures: [{code, description, quantity}],
  --   laudo: {file_id, storage_path, name, mime_type} }
  payload jsonb not null,
  -- O que o robô leu no portal antes da confirmação (beneficiário, nº da guia do prestador…).
  portal_summary jsonb,
  -- Resultado: { portal_status, guide_number, message }.
  result jsonb,
  screenshot_path text,
  error text,
  requested_by uuid references profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  confirmed_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  agent_id uuid references portal_robot_agents(id) on delete set null,
  claimed_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index portal_robot_jobs_draft_idx on portal_robot_jobs (draft_id, requested_at desc);
create index portal_robot_jobs_queue_idx on portal_robot_jobs (clinic_id, requested_at) where status = 'na_fila';
create index portal_robot_jobs_requested_by_idx on portal_robot_jobs (requested_by);
create index portal_robot_jobs_confirmed_by_idx on portal_robot_jobs (confirmed_by);
create index portal_robot_jobs_agent_idx on portal_robot_jobs (agent_id);
-- Um pedido em aberto por contato: dois cliques não viram duas guias no portal.
create unique index portal_robot_jobs_one_open_per_draft on portal_robot_jobs (draft_id)
  where status in ('na_fila', 'em_andamento', 'aguardando_confirmacao', 'confirmado');

create or replace function portal_robot_jobs_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger portal_robot_jobs_touch before update on portal_robot_jobs
  for each row execute function portal_robot_jobs_touch();

alter table portal_robot_agents enable row level security;
alter table portal_robot_professionals enable row level security;
alter table portal_robot_jobs enable row level security;

-- Agentes: a recepção só lê (para mostrar "robô ligado/desligado"). Escrita só pelo service role.
create policy portal_robot_agents_read on portal_robot_agents for select
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));

create policy portal_robot_professionals_read on portal_robot_professionals for select
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));
create policy portal_robot_professionals_insert on portal_robot_professionals for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));
create policy portal_robot_professionals_update on portal_robot_professionals for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));

create policy portal_robot_jobs_read on portal_robot_jobs for select
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));
create policy portal_robot_jobs_insert on portal_robot_jobs for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['gestor','supervisor','recepcao'])
              and exists (select 1 from registration_drafts d
                          where d.id = draft_id and d.clinic_id = (select current_clinic_id())));
-- Update pela tela só para confirmar/cancelar; as transições são validadas nas
-- server actions (app/recepcao/pacientes/pendencias/portal-robot-actions.ts).
create policy portal_robot_jobs_update on portal_robot_jobs for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['gestor','supervisor','recepcao']));

-- Reserva atômica do próximo pedido para um agente (skip locked: dois agentes
-- nunca pegam o mesmo). Antes, devolve à realidade pedidos de agentes que pararam
-- no meio: sem notícia há 15 min, o que ainda não foi confirmado vira "erro" (nada
-- foi enviado) e o que já estava confirmado vira "verificar" (pode ter sido enviado).
create or replace function claim_portal_robot_job(p_agent_id uuid)
returns setof portal_robot_jobs
language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid;
begin
  select clinic_id into v_clinic from portal_robot_agents where id = p_agent_id and active;
  if v_clinic is null then
    return;
  end if;

  update portal_robot_jobs
     set status = case when status = 'confirmado' then 'verificar' else 'erro' end,
         error = case when status = 'confirmado'
                      then 'O robô parou depois da confirmação: confira no portal se a guia foi enviada.'
                      else 'O robô parou no meio do preenchimento. Nada foi enviado ao plano.' end,
         finished_at = now()
   where clinic_id = v_clinic
     and status in ('em_andamento', 'aguardando_confirmacao', 'confirmado')
     and updated_at < now() - case when status = 'aguardando_confirmacao' then interval '60 minutes'
                                   else interval '15 minutes' end;

  return query
  update portal_robot_jobs j
     set status = 'em_andamento', agent_id = p_agent_id, claimed_at = now(), step = 0, step_label = 'Abrindo o portal'
   where j.id = (
     select id from portal_robot_jobs
      where clinic_id = v_clinic and status = 'na_fila'
      order by requested_at
      limit 1
      for update skip locked)
  returning j.*;
end;
$$;

revoke execute on function claim_portal_robot_job(uuid) from public, anon, authenticated;
grant execute on function claim_portal_robot_job(uuid) to service_role;

comment on table portal_robot_jobs is
  'Pedidos de envio da guia ao portal do plano feitos pelo robô (agente local). Ver docs/portal-robot.md.';
