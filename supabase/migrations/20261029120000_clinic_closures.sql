-- Calendário de funcionamento da clínica: feriados nacionais + fechamentos
-- cadastrados + expediente (clinic_business_hours) viram uma regra única do
-- banco, aplicada por trigger em `appointments` — mesmo desenho do
-- `appointments_availability_guard` (20260909220000): um ponto de checagem
-- para todos os fluxos que gravam agendamento (agenda de 1ª avaliação, PTS,
-- recorrência da grade, recepção), em vez de repetir em cada server action.
-- A regra espelha lib/clinic-calendar-pure.ts (a UI usa aquela pra pintar a
-- agenda de cinza; testes em tests/clinic-calendar-pure.test.ts).
--
-- NÃO mexe em agendamentos já existentes: o trigger só dispara em INSERT ou
-- quando starts_at/ends_at mudam.
--
-- NÃO altera o expediente cadastrado. A grade de clinic_business_hours foi
-- criada PRESUMIDA como seg–sex 08–18 (20260920000000); o expediente real
-- (seg–sex 08–19, sáb 08–12) é um UPDATE de dado em produção, a aplicar à
-- parte só quando o responsável pedir — ele também muda o relógio de SLA do
-- chatbot (business_minutes_between).

-- ---------------------------------------------------------------------
-- 1. Fechamentos pontuais (feriado municipal/estadual, recesso, reunião)
-- ---------------------------------------------------------------------
create table clinic_closures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  closure_date date not null,
  -- Ambos nulos = dia inteiro. Janela parcial exige os dois.
  start_time time,
  end_time time,
  reason text not null check (length(btrim(reason)) > 0),
  kind text not null default 'fechamento'
    check (kind in ('feriado_municipal', 'feriado_estadual', 'recesso', 'fechamento')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check ((start_time is null) = (end_time is null)),
  check (end_time is null or end_time > start_time)
);

create index idx_clinic_closures_clinic_date on clinic_closures (clinic_id, closure_date);

alter table clinic_closures enable row level security;

create policy clinic_closures_read on clinic_closures for select
  using (clinic_id = (select current_clinic_id()));
create policy clinic_closures_manage_ins on clinic_closures for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy clinic_closures_manage_upd on clinic_closures for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']))
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['supervisor','gestor']));
create policy clinic_closures_manage_del on clinic_closures for delete
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = any (array['supervisor','gestor']));

-- ---------------------------------------------------------------------
-- 2. Feriado nacional (fixos + móveis a partir da Páscoa)
-- ---------------------------------------------------------------------
-- Páscoa gregoriana, algoritmo de Meeus/Jones/Butcher (igual ao da lib TS).
create function easter_sunday(p_year int) returns date
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  mon int := (h + l - 7 * m + 114) / 31;
  dia int := ((h + l - 7 * m + 114) % 31) + 1;
begin
  return make_date(p_year, mon, dia);
end;
$$;

-- Nome do feriado nacional na data (ou null). Inclui Carnaval (seg/ter) e
-- Corpus Christi, que são ponto facultativo mas a clínica fecha.
create function national_holiday_name(p_date date) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  y int := extract(year from p_date)::int;
  easter date := easter_sunday(y);
begin
  return case
    when p_date = make_date(y, 1, 1)   then 'Confraternização Universal'
    when p_date = easter - 48          then 'Carnaval (segunda-feira)'
    when p_date = easter - 47          then 'Carnaval (terça-feira)'
    when p_date = easter - 2           then 'Sexta-feira Santa'
    when p_date = make_date(y, 4, 21)  then 'Tiradentes'
    when p_date = make_date(y, 5, 1)   then 'Dia do Trabalho'
    when p_date = easter + 60          then 'Corpus Christi'
    when p_date = make_date(y, 9, 7)   then 'Independência do Brasil'
    when p_date = make_date(y, 10, 12) then 'Nossa Senhora Aparecida'
    when p_date = make_date(y, 11, 2)  then 'Finados'
    when p_date = make_date(y, 11, 15) then 'Proclamação da República'
    when p_date = make_date(y, 11, 20) then 'Consciência Negra'
    when p_date = make_date(y, 12, 25) then 'Natal'
    else null
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Motivo de fechamento para [p_start, p_end) (null = aberta)
-- ---------------------------------------------------------------------
-- Ordem: feriado → fechamento cadastrado → expediente. Clínica SEM nenhuma
-- linha em clinic_business_hours = expediente "não configurado": só feriado e
-- fechamentos valem (mesma saída do availability_guard — não bloquear tudo
-- no dia em que a regra nasce).
create function clinic_closed_reason(p_clinic_id uuid, p_start timestamptz, p_end timestamptz)
returns text
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_date date := (p_start at time zone 'America/Sao_Paulo')::date;
  v_t_start time := (p_start at time zone 'America/Sao_Paulo')::time;
  v_t_end time := (p_end at time zone 'America/Sao_Paulo')::time;
  v_dow int := extract(dow from v_date)::int;
  v_name text;
  v_closure record;
begin
  v_name := national_holiday_name(v_date);
  if v_name is not null then
    return format('Clínica fechada: %s (%s)', v_name, to_char(v_date, 'DD/MM'));
  end if;

  select * into v_closure
  from clinic_closures c
  where c.clinic_id = p_clinic_id
    and c.closure_date = v_date
    and (c.start_time is null
         or (v_t_start < c.end_time and v_t_end > c.start_time))
  limit 1;
  if found then
    return format('Clínica fechada: %s (%s)', v_closure.reason, to_char(v_date, 'DD/MM'));
  end if;

  if exists (select 1 from clinic_business_hours h where h.clinic_id = p_clinic_id) then
    -- Compromisso que atravessa a meia-noite nunca cabe num turno do dia.
    if (p_end at time zone 'America/Sao_Paulo')::date <> v_date
       or not exists (
         select 1 from clinic_business_hours h
         where h.clinic_id = p_clinic_id
           and h.day_of_week = v_dow
           and h.open_time <= v_t_start
           and h.close_time >= v_t_end
       ) then
      return format('Fora do expediente da clínica (%s)', to_char(v_date, 'DD/MM'));
    end if;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Guard em appointments
-- ---------------------------------------------------------------------
-- A clínica vem do paciente (appointments não tem clinic_id). Sem paciente ou
-- sem clínica resolvida, não há regra a aplicar.
create function appointments_clinic_hours_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_clinic uuid;
  v_reason text;
begin
  if new.status in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada') then
    return new;
  end if;

  if TG_OP = 'UPDATE'
     and new.starts_at = old.starts_at
     and new.ends_at = old.ends_at then
    return new;
  end if;

  select pt.clinic_id into v_clinic from patients pt where pt.id = new.patient_id;
  if v_clinic is null then
    return new;
  end if;

  v_reason := clinic_closed_reason(v_clinic, new.starts_at, new.ends_at);
  if v_reason is not null then
    raise exception '%', v_reason using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_appointments_clinic_hours_guard
  before insert or update on appointments
  for each row execute function appointments_clinic_hours_guard();
