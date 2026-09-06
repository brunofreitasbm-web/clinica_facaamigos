-- supabase/migrations/20260906000017_grade_recurrence_generation.sql
--
-- Geração automática de sessões futuras a partir da "grade" (app/supervisao/
-- grade-panel.tsx). Hoje a grade não é uma tabela de template separada — é
-- só a leitura agregada de `appointments` da semana corrente (ver
-- app/supervisao/page.tsx, query "starts_at >= semana atual"). As colunas
-- `recurrence_id`/`group_id` já existem em `appointments` desde
-- 20260904000006_appointments.sql mas nenhuma linha real as usa ainda
-- (confirmado via MCP: 100% das 6 linhas de appointments hoje têm
-- recurrence_id null) — ou seja, "gerar/editar a partir da grade" é
-- funcionalidade nova, não uma correção de dado existente.
--
-- Modelagem adotada: uma "série" da grade é o conjunto de `appointments`
-- que compartilham `recurrence_id`. Não criamos uma tabela de template
-- (`grade_templates` ou similar) porque isso duplicaria o que já existe em
-- `appointments` (paciente/terapeuta/sala/disciplina/horário) sem ganho —
-- o "padrão" da série é sempre derivável da sessão mais recente e não
-- cancelada daquele recurrence_id (função `generate_from_recurrence_anchor`
-- abaixo). Se um dia a grade precisar existir sem nenhuma sessão concreta
-- ainda gerada (ex.: série cadastrada antes da 1ª sessão), essa suposição
-- precisa ser revisitada — hoje toda série nasce de uma primeira sessão
-- real (app/recepcao/nova-sessao-dialog.tsx / lib/grade-recurrence.ts).

create index if not exists idx_appointments_recurrence_id on appointments (recurrence_id) where recurrence_id is not null;

-- Passo 1 (baixo nível): gera até `p_weeks_ahead` ocorrências semanais de um
-- padrão explícito, a partir de `p_from_date` (hoje, se nulo), pulando
-- datas que já têm sessão da mesma série (mesmo recurrence_id + starts_at) e
-- tratando conflito de horário (exclusion constraint de sala/terapeuta) por
-- ocorrência — uma semana com conflito (ex.: feriado com sala emprestada
-- pra outro evento) não aborta as demais.
--
-- security invoker (padrão): o INSERT interno respeita as RLS policies de
-- `appointments` normalmente — quem chama via app precisa ter role
-- recepcao/supervisor/gestor da clínica do paciente, exatamente como
-- `createAppointment` (app/recepcao/agenda/actions.ts) já exige hoje.
create function generate_recurrence_sessions(
  p_recurrence_id uuid,
  p_patient_id uuid,
  p_therapist_id uuid,
  p_room_id uuid,
  p_discipline text,
  p_appointment_type_id uuid,
  p_modality text,
  p_authorization_id uuid,
  p_is_provisional boolean,
  p_weekday int, -- 0=domingo..6=sábado, mesma convenção de extract(dow) e Date.getUTCDay()
  p_time_of_day time,
  p_duration_minutes int,
  p_weeks_ahead int default 8,
  p_from_date date default null
) returns table(starts_at timestamptz, created boolean, error text)
language plpgsql as $$
declare
  base_date date;
  current_dow int;
  target_date date;
  s_at timestamptz;
  e_at timestamptz;
  i int;
begin
  if p_weekday < 0 or p_weekday > 6 then
    raise exception 'weekday inválido: % (esperado 0=domingo..6=sábado)', p_weekday;
  end if;
  if p_duration_minutes <= 0 then
    raise exception 'duration_minutes precisa ser positivo';
  end if;
  if p_weeks_ahead <= 0 then
    return;
  end if;

  base_date := coalesce(p_from_date, current_date);
  current_dow := extract(dow from base_date)::int;
  if current_dow <> p_weekday then
    base_date := base_date + (((p_weekday - current_dow) + 7) % 7);
  end if;

  for i in 0..(p_weeks_ahead - 1) loop
    target_date := base_date + (i * 7);
    s_at := (target_date::text || ' ' || p_time_of_day::text)::timestamp at time zone 'America/Sao_Paulo';
    e_at := s_at + (p_duration_minutes || ' minutes')::interval;

    if exists (
      select 1 from appointments a
      where a.recurrence_id = p_recurrence_id and a.starts_at = s_at
    ) then
      starts_at := s_at;
      created := false;
      error := 'sessão já existe para essa data/série';
      return next;
      continue;
    end if;

    begin
      insert into appointments (
        patient_id, therapist_id, room_id, discipline, appointment_type_id,
        starts_at, ends_at, modality, recurrence_id, authorization_id,
        is_provisional, status
      ) values (
        p_patient_id, p_therapist_id, p_room_id, p_discipline, p_appointment_type_id,
        s_at, e_at, p_modality, p_recurrence_id, p_authorization_id,
        p_is_provisional, 'agendada'
      );
      starts_at := s_at;
      created := true;
      error := null;
    exception
      when exclusion_violation then
        -- Sala ou terapeuta já ocupado nesse horário (feriado com sala
        -- emprestada, conflito pontual etc.) — registra e segue pra próxima
        -- semana, não aborta a série inteira.
        starts_at := s_at;
        created := false;
        error := 'conflito de horário (sala ou terapeuta já ocupado)';
      when others then
        starts_at := s_at;
        created := false;
        error := sqlerrm;
    end;
    return next;
  end loop;
end;
$$;

revoke all on function generate_recurrence_sessions(
  uuid, uuid, uuid, uuid, text, uuid, text, uuid, boolean, int, time, int, int, date
) from public;
grant execute on function generate_recurrence_sessions(
  uuid, uuid, uuid, uuid, text, uuid, text, uuid, boolean, int, time, int, int, date
) to authenticated;

-- Passo 2: gera mais semanas de uma série JÁ EXISTENTE, derivando o padrão
-- (paciente/terapeuta/sala/disciplina/horário/duração) da sessão mais
-- recente e não cancelada daquele recurrence_id — não exige repassar todos
-- os parâmetros de novo pra "só continuar" a série corrente.
create function generate_from_recurrence_anchor(
  p_recurrence_id uuid,
  p_weeks_ahead int default 8
) returns table(starts_at timestamptz, created boolean, error text)
language plpgsql as $$
declare
  anchor appointments%rowtype;
begin
  select * into anchor
  from appointments a
  where a.recurrence_id = p_recurrence_id
    and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
  order by a.starts_at desc
  limit 1;

  if not found then
    raise exception 'nenhuma sessão ativa encontrada para recurrence_id %', p_recurrence_id;
  end if;

  return query
  select * from generate_recurrence_sessions(
    p_recurrence_id,
    anchor.patient_id,
    anchor.therapist_id,
    anchor.room_id,
    anchor.discipline,
    anchor.appointment_type_id,
    anchor.modality,
    anchor.authorization_id,
    anchor.is_provisional,
    extract(dow from (anchor.starts_at at time zone 'America/Sao_Paulo'))::int,
    (anchor.starts_at at time zone 'America/Sao_Paulo')::time,
    (extract(epoch from (anchor.ends_at - anchor.starts_at)) / 60)::int,
    p_weeks_ahead,
    ((anchor.starts_at at time zone 'America/Sao_Paulo')::date + 7)
  );
end;
$$;

revoke all on function generate_from_recurrence_anchor(uuid, int) from public;
grant execute on function generate_from_recurrence_anchor(uuid, int) to authenticated;

-- Passo 3 (cron): mantém ~8 semanas geradas pra toda série "ativa" — aqui
-- definida como recurrence_id com pelo menos uma sessão não cancelada nos
-- últimos 14 dias (série corrente; uma série sem sessão recente nem futura
-- foi abandonada/substituída por outra — ver editGradeSeries em
-- lib/grade-recurrence.ts — e não deve ser regenerada sozinha). security
-- definer (mesmo padrão de auto_resolve_appointments /
-- close_monthly_metric_snapshots): roda via pg_cron sem sessão de usuário
-- autenticado, precisa escrever em appointments de todas as clínicas
-- independente de RLS.
create function regenerate_active_grade_sessions(p_weeks_ahead int default 8) returns void
language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  for rec in
    select a.recurrence_id
    from appointments a
    where a.recurrence_id is not null
      and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
    group by a.recurrence_id
    having max(a.starts_at) >= now() - interval '14 days'
  loop
    begin
      perform * from generate_from_recurrence_anchor(rec.recurrence_id, p_weeks_ahead);
    exception when others then
      -- Uma série com dado inconsistente (ex.: paciente/sala desativados
      -- nesse meio-tempo) não pode travar a regeneração das demais séries.
      raise warning 'regenerate_active_grade_sessions: falhou para recurrence_id %: %', rec.recurrence_id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function regenerate_active_grade_sessions(int) from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'regenerate_active_grade_sessions_daily',
    '0 4 * * *',
    $job$select regenerate_active_grade_sessions(8);$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende regenerate_active_grade_sessions(8) externamente. %', sqlerrm;
end;
$$;
