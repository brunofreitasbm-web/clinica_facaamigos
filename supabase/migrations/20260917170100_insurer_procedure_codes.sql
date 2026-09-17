-- supabase/migrations/20260917170100_insurer_procedure_codes.sql
-- Código de procedimento de psicoterapia (e demais especialidades) varia por
-- operadora de convênio — cada uma tem sua própria tabela de códigos.
-- `insurer_price_tables` (20260904000003) já é "por operadora + código",
-- mas exige preço e janela de validade (é o insumo de faturamento); esta
-- tabela é o cadastro operacional mais simples que a recepção/gestor usa
-- para saber, por especialidade, qual código a operadora usa, se exige guia
-- prévia e se aceita atendimento em grupo (psicoterapia infantil, até 3
-- crianças por padrão).
create table insurer_procedure_codes (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id) on delete cascade,
  specialty_value text not null,
  procedure_code text not null,
  procedure_name text,
  requires_prior_auth boolean not null default true,
  group_allowed boolean not null default false,
  max_group_size int not null default 3 check (max_group_size between 1 and 6),
  session_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (insurer_id, specialty_value)
);

alter table insurer_procedure_codes enable row level security;

create policy insurer_procedure_codes_read on insurer_procedure_codes for select
  using (
    exists (select 1 from insurers i where i.id = insurer_procedure_codes.insurer_id and i.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao','faturamento')
  );

create policy insurer_procedure_codes_manage on insurer_procedure_codes for all
  using (
    exists (select 1 from insurers i where i.id = insurer_procedure_codes.insurer_id and i.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','faturamento')
  )
  with check (
    exists (select 1 from insurers i where i.id = insurer_procedure_codes.insurer_id and i.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','faturamento')
  );

-- Resolve o código de procedimento de uma especialidade para o convênio do
-- paciente (null quando o paciente é particular ou o convênio não tem
-- código cadastrado para a especialidade) — usado por createAppointment
-- (app/recepcao/agenda/actions.ts) antes de buscar a guia ativa
-- (lib/active-authorization.ts::getActiveAuthorizationId).
create function resolve_procedure_code(p_patient_id uuid, p_specialty text)
returns text
language sql stable as $$
  select ipc.procedure_code
  from patient_insurance pi
  join insurer_procedure_codes ipc
    on ipc.insurer_id = pi.insurer_id and ipc.specialty_value = p_specialty
  where pi.patient_id = p_patient_id
    and pi.is_private = false
  limit 1;
$$;
