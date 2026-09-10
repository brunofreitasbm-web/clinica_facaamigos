-- supabase/migrations/20260910020000_aba_training.sql
--
-- "Treino ABA": bloco de 2h formado por 3 sessões consecutivas de 40min,
-- atendido em TURMA (sala própria + dia da semana + horário fechado em
-- 08/10/14/16h) e pago com o saldo ACUMULADO das quatro guias ABA do
-- paciente (Psicologia ABA, Fonoaudiologia ABA, Terapia Ocupacional ABA e
-- Psicopedagogia ABA) — não com a guia de uma disciplina só.
--
-- Exemplo do cadastro real: 5 sessões autorizadas em cada uma das quatro
-- guias = 20 sessões de 40min no bolso; cada Treino ABA consome 3 dessas
-- sessões, então o paciente tem 6 blocos de 2h e sobram 2 sessões avulsas.
--
-- Nada disso é constante no código: o "3" é `appointment_types.
-- sessions_consumed` e o conjunto de guias que forma o bolso é
-- `appointment_types.aba_role = 'pool'` — trocar a regra é UPDATE, não
-- deploy.

-- =====================================================================
-- 1. Catálogo de tipos de atendimento
-- =====================================================================

-- 'pool'   = guia cujo saldo entra no bolso do Treino ABA.
-- 'treino' = o próprio bloco de Treino ABA.
alter table appointment_types add column aba_role text
  check (aba_role in ('pool', 'treino'));

-- Quantas sessões da guia um atendimento desse tipo consome ao ser fechado
-- como 'realizada'. Todo tipo já existente vale 1 — só o Treino ABA foge
-- disso (3 sessões de 40min num bloco de 2h).
alter table appointment_types add column sessions_consumed int not null default 1
  check (sessions_consumed >= 1);

-- Psicologia ABA já existe no cadastro; as outras três variantes ABA ainda
-- não (havia só 'Fonoaudiologia' e 'Terapia Ocupacional' convencionais, e
-- nenhuma psicopedagogia). O casamento guia↔disciplina do app é por
-- `authorizations.procedure_code` = nome do tipo (lib/active-authorization.ts),
-- então o nome cadastrado aqui é o mesmo que a recepção digita na guia.
update appointment_types set aba_role = 'pool' where name = 'Psicologia ABA';

insert into appointment_types
  (clinic_id, name, modality, duration_minutes, display_interval_minutes, recurrence, requires_intern_ratio, aba_role)
select c.id, v.name, 'presencial', 40, 40, 'semanal', true, 'pool'
from clinics c
cross join (values ('Fonoaudiologia ABA'), ('Terapia Ocupacional ABA'), ('Psicopedagogia ABA')) as v(name)
on conflict (clinic_id, name) do nothing;

insert into appointment_types
  (clinic_id, name, modality, duration_minutes, display_interval_minutes, recurrence, requires_intern_ratio, aba_role, sessions_consumed)
select c.id, 'Treino ABA', 'presencial', 120, 120, 'semanal', true, 'treino', 3
from clinics c
on conflict (clinic_id, name) do nothing;

-- =====================================================================
-- 2. Salas próprias de Treino ABA
-- =====================================================================

-- Turma só pode ser aberta em sala marcada aqui (validado no guard da
-- turma abaixo). A capacidade da turma é a `capacity` da própria sala — não
-- há um segundo número pra sair de sincronia.
alter table rooms add column is_aba_training boolean not null default false;

-- =====================================================================
-- 3. Turmas
-- =====================================================================

-- Turma é FIXA (sala + dia da semana + horário) e SEM matrícula: a recepção
-- encaixa o paciente sessão a sessão enquanto houver vaga na sala e saldo
-- no bolso das guias ABA.
create table aba_training_classes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  room_id uuid not null references rooms(id),
  -- 0=domingo..6=sábado, mesma convenção de extract(dow) já usada em
  -- professional_availability e generate_from_recurrence_anchor.
  day_of_week smallint not null check (day_of_week between 0 and 6),
  -- Horários fechados de entrada da turma: 8h, 10h, 14h ou 16h.
  start_time time not null check (start_time in ('08:00', '10:00', '14:00', '16:00')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, day_of_week, start_time)
);

alter table aba_training_classes enable row level security;

create index idx_aba_training_classes_clinic on aba_training_classes (clinic_id) where active;

-- Leitura pela clínica inteira (recepção agenda, terapeuta vê sua turma);
-- escrita restrita a quem administra o cadastro, mesmo padrão de
-- professional_availability (20260909220000).
create policy aba_training_classes_read on aba_training_classes for select
  using (clinic_id = (select current_clinic_id()));
create policy aba_training_classes_ins on aba_training_classes for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy aba_training_classes_upd on aba_training_classes for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy aba_training_classes_del on aba_training_classes for delete
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']));

create function aba_training_classes_room_guard() returns trigger
language plpgsql as $$
declare
  r rooms%rowtype;
begin
  select * into r from rooms where id = new.room_id;
  if not found then
    raise exception 'sala % não encontrada', new.room_id;
  end if;
  if not r.is_aba_training then
    raise exception 'turma de Treino ABA exige sala marcada como sala de Treino ABA';
  end if;
  if r.clinic_id <> new.clinic_id then
    raise exception 'sala pertence a outra clínica';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_aba_training_classes_room_guard
  before insert or update on aba_training_classes
  for each row execute function aba_training_classes_room_guard();

-- =====================================================================
-- 4. Sessão vinculada à turma
-- =====================================================================

alter table appointments add column aba_class_id uuid references aba_training_classes(id);

create index idx_appointments_aba_class on appointments (aba_class_id, starts_at)
  where aba_class_id is not null;

-- Guard de agendamento do Treino ABA. Mesma escolha do
-- appointments_availability_guard: a regra vive no banco, não em cada server
-- action, porque `appointments` é escrita pela recepção, pela geração da
-- grade recorrente e pela persistência do PTS.
create function appointments_aba_training_guard() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
  v_duration int;
  cls aba_training_classes%rowtype;
  r rooms%rowtype;
  civil_start timestamp;
  occupied int;
begin
  select at.aba_role, at.duration_minutes into v_role, v_duration
  from appointment_types at where at.id = new.appointment_type_id;

  if coalesce(v_role, '') <> 'treino' then
    if new.aba_class_id is not null then
      raise exception 'aba_class_id só vale para sessão de Treino ABA';
    end if;
    return new;
  end if;

  if new.aba_class_id is null then
    raise exception 'Treino ABA só pode ser agendado dentro de uma turma';
  end if;

  -- Sessão cancelada/remarcada perde a vaga na turma e não precisa mais ser
  -- validada contra horário/lotação — mesmo racional do availability guard.
  if new.status in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada') then
    return new;
  end if;

  select * into cls from aba_training_classes where id = new.aba_class_id;
  if not found or not cls.active then
    raise exception 'turma de Treino ABA inválida ou inativa';
  end if;

  if new.room_id <> cls.room_id then
    raise exception 'sessão de Treino ABA precisa acontecer na sala da turma';
  end if;

  -- Turma é atendimento coletivo: as exclusion constraints de sala e de
  -- terapeuta (20260904000006_appointments.sql) já abrem exceção pra
  -- modality='grupo', que é o que permite vários pacientes no mesmo
  -- horário/sala. Sem isso, o segundo paciente da turma seria rejeitado.
  if new.modality <> 'grupo' then
    raise exception 'sessão de Treino ABA precisa ter modalidade grupo';
  end if;

  civil_start := new.starts_at at time zone 'America/Sao_Paulo';
  if extract(dow from civil_start)::int <> cls.day_of_week then
    raise exception 'sessão de Treino ABA fora do dia da semana da turma';
  end if;
  if civil_start::time <> cls.start_time then
    raise exception 'sessão de Treino ABA fora do horário da turma (%)', cls.start_time;
  end if;

  if new.ends_at <> new.starts_at + make_interval(mins => v_duration) then
    raise exception 'sessão de Treino ABA precisa durar % minutos (3 sessões de 40min)', v_duration;
  end if;

  select * into r from rooms where id = cls.room_id;

  select count(*) into occupied
  from appointments a
  where a.aba_class_id = new.aba_class_id
    and a.starts_at = new.starts_at
    and a.id <> new.id
    and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada');

  if occupied >= r.capacity then
    raise exception 'turma de Treino ABA lotada (% vagas)', r.capacity;
  end if;

  if exists (
    select 1 from appointments a
    where a.aba_class_id = new.aba_class_id
      and a.starts_at = new.starts_at
      and a.patient_id = new.patient_id
      and a.id <> new.id
      and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
  ) then
    raise exception 'paciente já está nessa turma neste horário';
  end if;

  return new;
end;
$$;

create trigger trg_appointments_aba_training_guard
  before insert or update on appointments
  for each row execute function appointments_aba_training_guard();

-- =====================================================================
-- 5. Consumo do saldo acumulado
-- =====================================================================

-- Rastro de qual guia pagou quantas sessões de cada bloco — sem isso, um
-- Treino ABA que consome 2 sessões de uma guia e 1 de outra viraria um
-- `sessions_used` sem explicação na hora da conferência do faturamento.
create table aba_training_consumptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  authorization_id uuid not null references authorizations(id),
  units int not null check (units > 0),
  created_at timestamptz not null default now()
);

alter table aba_training_consumptions enable row level security;

create index idx_aba_training_consumptions_appointment
  on aba_training_consumptions (appointment_id);

-- Só leitura pelo app (quem escreve é o guard, security definer): o rateio
-- é derivado do fechamento da sessão, nunca digitado.
create policy aba_training_consumptions_read on aba_training_consumptions for select
  using (exists (
    select 1 from appointments a
    join patients p on p.id = a.patient_id
    where a.id = aba_training_consumptions.appointment_id
      and p.clinic_id = (select current_clinic_id())
  ));

-- Saldo do bolso ABA de um paciente numa data: soma das sessões restantes
-- das guias ativas e vigentes cujo procedimento é um dos tipos marcados
-- como 'pool'. `blocks_available` é o que a recepção precisa ver — quantos
-- blocos de 2h ainda cabem.
create function aba_training_balance(p_patient_id uuid, p_on_date date default current_date)
returns table (sessions_remaining int, blocks_available int)
language sql
stable
security definer
set search_path to 'public'
as $$
  with units as (
    select coalesce(max(at.sessions_consumed), 3) as per_block
    from appointment_types at
    where at.aba_role = 'treino'
  ),
  saldo as (
    select coalesce(sum(a.sessions_authorized - a.sessions_used), 0)::int as total
    from authorizations a
    join patient_insurance pi on pi.id = a.patient_insurance_id
    where pi.patient_id = p_patient_id
      and a.status = 'ativa'
      and p_on_date between a.valid_from and a.valid_to
      and a.procedure_code in (select name from appointment_types where aba_role = 'pool')
      and a.sessions_authorized > a.sessions_used
  )
  select saldo.total, (saldo.total / units.per_block)::int from saldo, units;
$$;

-- Rateia `p_units` sessões entre as guias do bolso, consumindo primeiro as
-- que vencem antes (a que expira primeiro é a que se perde se não for
-- usada). Levanta exceção se o saldo total não cobrir o bloco — o
-- appointments_authorization_guard chama isso dentro da mesma transação do
-- fechamento, então ou o bloco inteiro é pago ou a sessão não fecha.
create function aba_training_consume_pool(
  p_appointment_id uuid,
  p_patient_id uuid,
  p_on_date date,
  p_units int
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  remaining int := p_units;
  take int;
  guia record;
  total int;
begin
  select coalesce(sum(a.sessions_authorized - a.sessions_used), 0)::int into total
  from authorizations a
  join patient_insurance pi on pi.id = a.patient_insurance_id
  where pi.patient_id = p_patient_id
    and a.status = 'ativa'
    and p_on_date between a.valid_from and a.valid_to
    and a.procedure_code in (select name from appointment_types where aba_role = 'pool')
    and a.sessions_authorized > a.sessions_used;

  if total < p_units then
    raise exception 'saldo ABA insuficiente: bloco exige % sessões e o paciente tem % nas guias ABA vigentes', p_units, total;
  end if;

  for guia in
    select a.id, (a.sessions_authorized - a.sessions_used) as livre
    from authorizations a
    join patient_insurance pi on pi.id = a.patient_insurance_id
    where pi.patient_id = p_patient_id
      and a.status = 'ativa'
      and p_on_date between a.valid_from and a.valid_to
      and a.procedure_code in (select name from appointment_types where aba_role = 'pool')
      and a.sessions_authorized > a.sessions_used
    order by a.valid_to asc, a.id asc
    for update
  loop
    exit when remaining <= 0;
    take := least(remaining, guia.livre);
    update authorizations set sessions_used = sessions_used + take where id = guia.id;
    insert into aba_training_consumptions (appointment_id, authorization_id, units)
      values (p_appointment_id, guia.id, take);
    remaining := remaining - take;
  end loop;

  if remaining > 0 then
    raise exception 'saldo ABA insuficiente ao ratear o bloco (faltaram % sessões)', remaining;
  end if;
end;
$$;

-- Reescreve o guard de autorização (última versão em
-- 20260904000014_final_review_fixes.sql) para desviar o Treino ABA pro
-- rateio acima. Todo o resto do comportamento — condição de transição,
-- validação de vigência, incremento de 1 — fica idêntico.
create or replace function appointments_authorization_guard() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  auth_row authorizations%rowtype;
  v_role text;
  v_units int;
begin
  if new.status = 'realizada' and new.is_provisional = false
     and (
       TG_OP = 'INSERT'
       or old.status <> 'realizada'
       or old.is_provisional <> new.is_provisional
     ) then

    select at.aba_role, at.sessions_consumed into v_role, v_units
    from appointment_types at where at.id = new.appointment_type_id;

    if coalesce(v_role, '') = 'treino' then
      perform aba_training_consume_pool(
        new.id, new.patient_id, (new.starts_at at time zone 'America/Sao_Paulo')::date, coalesce(v_units, 3)
      );
      return new;
    end if;

    if new.authorization_id is null then
      raise exception 'sessão realizada exige authorization_id (a menos que is_provisional)';
    end if;
    select * into auth_row from authorizations where id = new.authorization_id for update;
    if not found then
      raise exception 'autorização % não encontrada', new.authorization_id;
    end if;
    if auth_row.status <> 'ativa' then
      raise exception 'autorização % não está ativa (status=%)', new.authorization_id, auth_row.status;
    end if;
    if new.starts_at::date < auth_row.valid_from or new.starts_at::date > auth_row.valid_to then
      raise exception 'sessão fora da vigência da autorização %', new.authorization_id;
    end if;
    if auth_row.sessions_used >= auth_row.sessions_authorized then
      raise exception 'autorização % sem sessões restantes', new.authorization_id;
    end if;
    update authorizations set sessions_used = sessions_used + 1 where id = new.authorization_id;
  end if;
  return new;
end;
$$;
