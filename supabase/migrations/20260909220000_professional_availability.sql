-- supabase/migrations/20260909220000_professional_availability.sql
--
-- Agenda real de disponibilidade dos profissionais: até aqui não existia
-- nenhuma representação de "quando um terapeuta atende" — a única proteção
-- contra sobreposição era a `exclude using gist` de `appointments`
-- (20260904000006_appointments.sql), que só impede dois compromissos no
-- mesmo horário, sem checar se aquele horário está dentro do expediente do
-- terapeuta. Isso permitia, por exemplo, o "Calendário Conciliado" do PTS
-- (app/supervisao/planos/novo/plan-form.tsx) gerar sessões para terapeutas
-- fictícios em qualquer turno, sem nenhuma consulta real.
--
-- Disponibilidade é genérica por terapeuta (dias da semana + janela de
-- horário), não por disciplina — não há hoje vínculo terapeuta↔especialidade
-- no schema (só o catálogo solto `specialties`), então uma disponibilidade
-- por disciplina exigiria modelar esse vínculo também, fora do escopo desta
-- tarefa.
-- Postgres não tem um range type nativo para `time` (só tsrange/tstzrange/
-- daterange/numrange/int*range) — precisa declarar um pra poder usar
-- `exclude using gist` contra sobreposição de horário dentro do mesmo dia.
create type timerange as range (subtype = time);

create table professional_availability (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  profile_id uuid not null references profiles(id),
  -- 0=domingo..6=sábado — mesma convenção de extract(dow) já usada em
  -- generate_from_recurrence_anchor (20260906000017_grade_recurrence_generation.sql).
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  exclude using gist (
    profile_id with =,
    day_of_week with =,
    timerange(start_time, end_time) with &&
  ) where (active)
);

alter table professional_availability enable row level security;

create index idx_professional_availability_clinic_profile
  on professional_availability (clinic_id, profile_id) where active;

-- Leitura pela clínica inteira: recepção/supervisor/gestor precisam consultar
-- pra agendar, e o próprio terapeuta pode ver sua janela cadastrada.
create policy professional_availability_read on professional_availability for select
  using (clinic_id = (select current_clinic_id()));

-- Policies separadas por comando (não `for all`), seguindo o padrão de
-- specialties (20260907180000_specialties_catalog.sql) — escrita restrita a
-- quem administra a equipe.
create policy professional_availability_manage_ins on professional_availability for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy professional_availability_manage_upd on professional_availability for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy professional_availability_manage_del on professional_availability for delete
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']));

-- Bloqueio real de agendamento fora da janela cadastrada. Único ponto de
-- checagem para todos os fluxos que gravam em `appointments` (recepção,
-- persistência do PTS, geração de recorrência da grade) — mesmo racional do
-- `appointments_authorization_guard` existente: uma regra no banco em vez de
-- duplicar a checagem em cada server action.
--
-- `generate_recurrence_sessions` (20260906000017_grade_recurrence_generation.sql)
-- já envolve o insert num `exception when others then error := sqlerrm`
-- genérico — a exceção levantada aqui cai nesse ramo automaticamente,
-- marcando só aquela ocorrência como erro sem abortar a série. Não precisa
-- alterar aquela função.
create function appointments_availability_guard() returns trigger
language plpgsql as $$
declare
  dow int;
  t_start time;
  t_end time;
begin
  if new.status in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada') then
    return new;
  end if;

  if TG_OP = 'UPDATE'
     and new.starts_at = old.starts_at
     and new.ends_at = old.ends_at
     and new.therapist_id = old.therapist_id then
    return new;
  end if;

  -- Terapeuta sem NENHUMA janela cadastrada ainda = disponibilidade "não
  -- configurada", não "indisponível o tempo todo". Sem essa saída, esta
  -- migration bloquearia instantaneamente todo agendamento novo pra
  -- qualquer terapeuta já existente (nenhum tem disponibilidade cadastrada
  -- no dia em que esta tabela é criada). O bloqueio passa a valer terapeuta
  -- a terapeuta, à medida que o supervisor cadastra a janela de cada um em
  -- /supervisao/disponibilidade.
  if not exists (
    select 1 from professional_availability pa
    where pa.profile_id = new.therapist_id and pa.active
  ) then
    return new;
  end if;

  dow := extract(dow from (new.starts_at at time zone 'America/Sao_Paulo'))::int;
  t_start := (new.starts_at at time zone 'America/Sao_Paulo')::time;
  t_end := (new.ends_at at time zone 'America/Sao_Paulo')::time;

  if not exists (
    select 1 from professional_availability pa
    where pa.profile_id = new.therapist_id
      and pa.active
      and pa.day_of_week = dow
      and pa.start_time <= t_start
      and pa.end_time >= t_end
  ) then
    raise exception 'terapeuta fora da janela de disponibilidade cadastrada';
  end if;

  return new;
end;
$$;

create trigger trg_appointments_availability_guard
  before insert or update on appointments
  for each row execute function appointments_availability_guard();
