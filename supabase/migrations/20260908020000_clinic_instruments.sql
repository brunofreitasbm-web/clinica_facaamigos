-- supabase/migrations/20260908020000_clinic_instruments.sql
--
-- Liga/desliga por clínica dos instrumentos de avaliação que têm
-- implementação própria no sistema (lib/native-instruments.ts: Socially Savvy,
-- ADL, ADL-2, PROC — e os que vierem depois). Guarda também os dados de
-- licença, que antes só existiam em `protocols` (license_purchased_at /
-- license_note) e ficaram sem lugar quando esses instrumentos saíram do
-- catálogo genérico em lib/protocol-catalog.ts.
--
-- O catálogo em si NÃO fica aqui: cada instrumento tem escala, itens e
-- cálculo próprios em código, então cadastrar "nome do instrumento" no banco
-- só criaria linhas que o sistema não sabe aplicar. Esta tabela guarda
-- exclusivamente o estado por clínica; `instrument` é validado contra o
-- catálogo em código na Server Action, no mesmo espírito de
-- lib/protocol-catalog.ts (validação de nome fora do banco, "mais fácil de
-- estender sem migration a cada protocolo novo").
--
-- Ausência de linha = HABILITADO (ver DEFAULT_ENABLED em
-- lib/clinic-instruments.ts): a clínica já usava ADL/ADL-2/PROC antes desta
-- tela existir, e um padrão "desligado" cortaria o acesso a instrumentos em
-- uso no momento em que esta migração rodasse. Desabilitar é sempre um ato
-- explícito do gestor.
create table clinic_instruments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  instrument text not null,
  enabled boolean not null default true,
  license_purchased_at date,
  license_note text,
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, instrument)
);

alter table clinic_instruments enable row level security;

-- Leitura para toda a clínica: o prontuário do terapeuta precisa saber se
-- deve mostrar o atalho do instrumento e se a tela pode abrir.
create policy clinic_instruments_read on clinic_instruments for select
  using (clinic_id = (select current_clinic_id()));

-- Escrita só do gestor — é configuração da clínica, não dado clínico.
create policy clinic_instruments_manage_ins on clinic_instruments for insert
  with check (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = 'gestor'
  );

create policy clinic_instruments_manage_upd on clinic_instruments for update
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = 'gestor'
  )
  with check (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = 'gestor'
  );

create index idx_clinic_instruments_clinic on clinic_instruments (clinic_id);
create index idx_clinic_instruments_updated_by on clinic_instruments (updated_by);
