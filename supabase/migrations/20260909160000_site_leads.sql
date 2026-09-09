-- Leads do site público (landing page em app/site).
--
-- Quem escreve aqui é um visitante sem sessão — pai/mãe que preencheu o
-- formulário de "agendar avaliação". Mesmo desenho de app/ficha e app/checkin:
-- a escrita pública passa por service-role em Server Action, e NÃO existe
-- policy de insert para `anon`. Assim a validação (tamanho, telefone,
-- anti-flood) mora num lugar só, no servidor, e não numa policy que qualquer
-- um poderia exercitar direto com a chave publicável.
--
-- As policies abaixo valem apenas para a equipe logada, que trabalha a fila
-- de leads: recepção liga, marca a avaliação e anota o desfecho.
create table site_leads (
  id uuid primary key default gen_random_uuid(),
  -- Default fixo na clínica semente (mesma constante usada nos seeds de
  -- clinic_checkin_tokens): o site é single-tenant e o visitante não tem
  -- sessão de onde derivar `current_clinic_id()`.
  clinic_id uuid not null references clinics(id)
    default 'c0000000-0000-0000-0000-000000000001',

  responsavel_nome text not null check (char_length(responsavel_nome) between 2 and 120),
  telefone text not null check (char_length(telefone) between 8 and 30),
  -- Idade como texto de propósito: a família escreve "2 anos e meio",
  -- "quase 4". Transformar em inteiro aqui perderia informação e criaria
  -- fricção no formulário — o que mata conversão.
  crianca_idade text check (crianca_idade is null or char_length(crianca_idade) <= 60),
  mensagem text check (mensagem is null or char_length(mensagem) <= 2000),

  -- De onde veio o clique (utm_source do anúncio, "whatsapp", "organico").
  -- É o que permite dizer depois qual campanha traz família que agenda.
  origem text not null default 'site' check (char_length(origem) <= 120),

  status text not null default 'novo'
    check (status in ('novo', 'em_contato', 'agendado', 'descartado')),
  atendido_por uuid references profiles(id),
  atendido_em timestamptz,
  observacao_interna text,

  created_at timestamptz not null default now()
);

-- A tela da recepção é sempre "leads novos primeiro, mais recentes no topo".
create index idx_site_leads_fila on site_leads (clinic_id, status, created_at desc);
-- Trava anti-flood da Server Action: "este telefone já mandou algo agora?".
create index idx_site_leads_telefone_recente on site_leads (telefone, created_at desc);

alter table site_leads enable row level security;

comment on table site_leads is
  'Leads do formulário público da landing page (app/site). Insert só via service-role na Server Action; RLS abaixo é para a equipe que trabalha a fila.';

create policy site_leads_read on site_leads for select
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor', 'supervisor', 'recepcao')
  );

-- Só o desfecho do contato é editável pela equipe; o que a família escreveu
-- (nome, telefone, mensagem) fica imutável — é a prova de o que foi pedido.
create policy site_leads_update on site_leads for update
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor', 'supervisor', 'recepcao')
  )
  with check (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor', 'supervisor', 'recepcao')
  );
