-- supabase/migrations/20260920000000_conversation_attendances.sql
-- Rotina de tempo de resposta e fechamento de atendimentos do WhatsApp.
--
-- `twilio_conversations` é UMA linha por telefone e é reaberta a cada nova
-- mensagem — não existe o conceito de "atendimento" (episódio com começo e
-- fim), então não dava para medir quanto o lead esperou por uma resposta
-- efetiva (bot ou humano) nem como o atendimento terminou. Esta migration cria
-- `conversation_attendances`, preenchida SOZINHA por triggers em `messages`,
-- `twilio_conversations` e `appointments` (não é preciso mexer nos vários bots
-- que já gravam em `messages`), e as views do Metabase com meta + mês anterior
-- (AGENTS.md: todo KPI precisa de comparativo).

-- =====================================================================
-- 1. Horário comercial (o relógio da resposta humana só corre nele)
-- =====================================================================
create table clinic_business_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = domingo (extract(dow))
  open_time time not null,
  close_time time not null,
  timezone text not null default 'America/Belem',
  check (close_time > open_time),
  unique (clinic_id, day_of_week, open_time)
);

alter table clinic_business_hours enable row level security;

create policy clinic_business_hours_read on clinic_business_hours for select
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor','supervisor','recepcao'));
create policy clinic_business_hours_manage on clinic_business_hours for all
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor','supervisor'))
  with check (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor','supervisor'));

-- Grade PRESUMIDA (seg–sex 08–18, sáb 08–12): ajustar na tabela se o
-- expediente real for outro — as views recalculam sozinhas.
insert into clinic_business_hours (clinic_id, day_of_week, open_time, close_time)
select c.id, d.dow, '08:00', case when d.dow = 6 then '12:00'::time else '18:00'::time end
from clinics c
cross join (values (1),(2),(3),(4),(5),(6)) as d(dow);

-- Minutos de horário comercial entre dois instantes (interseção com a grade).
create or replace function business_minutes_between(p_clinic_id uuid, p_from timestamptz, p_to timestamptz)
returns numeric
language sql stable set search_path = public as $$
  select coalesce(sum(greatest(0, extract(epoch from (
      least(p_to, ((d.day + h.close_time) at time zone h.timezone))
      - greatest(p_from, ((d.day + h.open_time) at time zone h.timezone))
    )) / 60.0)), 0)
  from clinic_business_hours h
  cross join lateral generate_series(
    (p_from at time zone h.timezone)::date,
    (p_to at time zone h.timezone)::date,
    interval '1 day'
  ) as g(day_ts)
  cross join lateral (select g.day_ts::date as day) d
  where p_to > p_from
    and h.clinic_id = p_clinic_id
    and h.day_of_week = extract(dow from d.day);
$$;

-- Mesma normalização de lib/twilio.ts (normalizeBrLocalPhone): sem DDI e sem o
-- "9" de celular, para casar cadastros antigos com o E.164 da conversa.
create or replace function normalize_br_phone_key(p_phone text)
returns text
language plpgsql immutable set search_path = public as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if digits like '55%' and length(digits) > 11 then
    digits := substr(digits, 3);
  end if;
  if length(digits) = 11 then
    return substr(digits, 1, 2) || substr(digits, 4);
  end if;
  return digits;
end;
$$;

-- =====================================================================
-- 2. Atendimentos
-- =====================================================================
create table conversation_attendances (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  conversation_id uuid not null references twilio_conversations(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  kind text not null default 'lead' check (kind in ('lead','patient')),
  opened_at timestamptz not null,
  first_bot_reply_at timestamptz,
  escalated_at timestamptz,
  first_agent_reply_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  closed_at timestamptz,
  outcome text check (outcome in ('agendado','resolvido','sem_retorno','perdido','spam','nao_classificado')),
  outcome_note text,
  closed_by uuid references profiles(id) on delete set null,
  closed_by_kind text check (closed_by_kind in ('bot','agent','system')),
  appointment_id uuid references appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((closed_at is null) = (outcome is null))
);

-- No máximo um atendimento aberto por conversa.
create unique index conversation_attendances_one_open_idx
  on conversation_attendances (conversation_id) where closed_at is null;
create index conversation_attendances_clinic_opened_idx
  on conversation_attendances (clinic_id, opened_at desc);
create index conversation_attendances_patient_idx on conversation_attendances (patient_id);
create index conversation_attendances_appointment_idx on conversation_attendances (appointment_id);
create index conversation_attendances_closed_by_idx on conversation_attendances (closed_by);

alter table conversation_attendances enable row level security;

create policy conversation_attendances_read on conversation_attendances for select
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor','supervisor','recepcao'));
create policy conversation_attendances_update on conversation_attendances for update
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor','supervisor','recepcao'))
  with check (clinic_id = (select current_clinic_id()) and (select app_current_role()) in ('gestor','supervisor','recepcao'));
-- Sem policy de insert/delete: quem cria atendimentos são os triggers abaixo
-- (security definer).

-- =====================================================================
-- 3. Triggers
-- =====================================================================

-- 3.1 Mensagens: abre o atendimento no 1º inbound e carimba as respostas.
create or replace function fn_attendance_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_conv record;
  v_ts timestamptz := coalesce(new.sent_at, now());
begin
  if new.conversation_id is null then
    return new;
  end if;

  select clinic_id, patient_id, kind into v_conv
  from twilio_conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  if new.direction = 'inbound' and new.sender_type = 'user' then
    insert into conversation_attendances (clinic_id, conversation_id, patient_id, kind, opened_at, last_inbound_at)
    values (v_conv.clinic_id, new.conversation_id, v_conv.patient_id, v_conv.kind, v_ts, v_ts)
    on conflict (conversation_id) where closed_at is null
    do update set last_inbound_at = greatest(coalesce(conversation_attendances.last_inbound_at, excluded.last_inbound_at), excluded.last_inbound_at);

  elsif new.direction = 'outbound' and new.sender_type = 'bot' then
    update conversation_attendances
       set first_bot_reply_at = coalesce(first_bot_reply_at, v_ts),
           last_outbound_at = greatest(coalesce(last_outbound_at, v_ts), v_ts)
     where conversation_id = new.conversation_id and closed_at is null;

  elsif new.direction = 'outbound' and new.sender_type = 'agent' then
    update conversation_attendances
       set first_agent_reply_at = coalesce(first_agent_reply_at, v_ts),
           last_outbound_at = greatest(coalesce(last_outbound_at, v_ts), v_ts)
     where conversation_id = new.conversation_id and closed_at is null;
  end if;

  return new;
exception when others then
    raise warning '% falhou: %', TG_NAME, sqlerrm;
    return new;
end;
$$;

create trigger trg_attendance_on_message after insert on messages
  for each row execute function fn_attendance_on_message();

-- 3.2 Escalação do bot para humano (lib/twilio-faq-bot.ts grava escalated_at).
create or replace function fn_attendance_on_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.escalated_at is not null and new.escalated_at is distinct from old.escalated_at then
    update conversation_attendances
       set escalated_at = new.escalated_at
     where conversation_id = new.id and closed_at is null and escalated_at is null;
  end if;
  return new;
exception when others then
    raise warning '% falhou: %', TG_NAME, sqlerrm;
    return new;
end;
$$;

create trigger trg_attendance_on_escalation after update of escalated_at on twilio_conversations
  for each row execute function fn_attendance_on_escalation();

-- 3.3 Agendamento: fecha o atendimento aberto como 'agendado'. O casamento é
-- pelo paciente OU pelo telefone do responsável, porque o lead só é vinculado
-- ao paciente na mensagem seguinte (lib/twilio.ts). Só conta quando o
-- atendimento é de lead, a consulta é avaliação ou o paciente ainda é
-- 'interessado' — senão a geração recorrente da grade de um paciente antigo
-- que só mandou "preciso remarcar" fecharia o atendimento como venda.
create or replace function fn_attendance_on_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid;
  v_status text;
begin
  select clinic_id, status into v_clinic, v_status from patients where id = new.patient_id;
  if v_clinic is null then
    return new;
  end if;

  update conversation_attendances a
     set closed_at = now(),
         outcome = 'agendado',
         closed_by_kind = 'system',
         appointment_id = new.id
    from twilio_conversations c
   where a.conversation_id = c.id
     and a.closed_at is null
     and a.clinic_id = v_clinic
     and (a.kind = 'lead' or new.is_evaluation or v_status = 'interessado')
     and (
       c.patient_id = new.patient_id
       or normalize_br_phone_key(c.phone_number) in (
         select normalize_br_phone_key(g.phone) from guardians g
          where g.patient_id = new.patient_id and g.phone is not null
       )
     );

  return new;
exception when others then
    raise warning '% falhou: %', TG_NAME, sqlerrm;
    return new;
end;
$$;

create trigger trg_attendance_on_appointment after insert on appointments
  for each row execute function fn_attendance_on_appointment();

revoke execute on function fn_attendance_on_message() from public, anon, authenticated;
revoke execute on function fn_attendance_on_escalation() from public, anon, authenticated;
revoke execute on function fn_attendance_on_appointment() from public, anon, authenticated;

-- 3.4 Encerramento por inatividade: a clínica falou por último e o lead ficou
-- 24h em silêncio → 'sem_retorno'. Se a última mensagem foi do LEAD o
-- atendimento NÃO fecha: é backlog "aguardando a clínica" nas views.
create or replace function close_stale_attendances() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  update conversation_attendances
     set closed_at = now(),
         outcome = 'sem_retorno',
         closed_by_kind = 'system'
   where closed_at is null
     and last_outbound_at is not null
     and last_outbound_at > coalesce(last_inbound_at, '-infinity'::timestamptz)
     and last_outbound_at <= now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function close_stale_attendances() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'close_stale_attendances_15min',
    '*/15 * * * *',
    $job$select close_stale_attendances();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende close_stale_attendances() externamente. %', sqlerrm;
end;
$$;

-- =====================================================================
-- 4. Backfill do histórico de `messages`
-- Episódio novo = mensagem depois de >= 24h de silêncio. Só vale episódio com
-- inbound de lead. Fechados como 'nao_classificado' (entram nos KPIs de
-- tempo, ficam fora da taxa de fechamento); o último episódio de cada
-- conversa continua aberto se ainda tem menos de 24h.
-- =====================================================================
with m as (
  select conversation_id, sent_at as ts, direction, sender_type
  from messages
  where conversation_id is not null and sent_at is not null
),
marked as (
  select m.*,
         case when lag(ts) over w is null or ts - lag(ts) over w >= interval '24 hours' then 1 else 0 end as is_start
  from m
  window w as (partition by conversation_id order by ts)
),
grp as (
  select marked.*, sum(is_start) over (partition by conversation_id order by ts) as ep
  from marked
),
episodes as (
  select conversation_id, ep,
         min(ts) filter (where direction = 'inbound' and sender_type = 'user') as opened_at,
         max(ts) filter (where direction = 'inbound' and sender_type = 'user') as last_inbound_at,
         min(ts) filter (where direction = 'outbound' and sender_type = 'bot') as first_bot_reply_at,
         min(ts) filter (where direction = 'outbound' and sender_type = 'agent') as first_agent_reply_at,
         max(ts) filter (where direction = 'outbound') as last_outbound_at,
         max(ts) as last_ts,
         max(ep) over (partition by conversation_id) as last_ep
  from grp
  group by conversation_id, ep
)
insert into conversation_attendances (
  clinic_id, conversation_id, patient_id, kind, opened_at, first_bot_reply_at, escalated_at,
  first_agent_reply_at, last_inbound_at, last_outbound_at, closed_at, outcome, closed_by_kind
)
select c.clinic_id, e.conversation_id, c.patient_id, c.kind, e.opened_at, e.first_bot_reply_at,
       case when c.escalated_at between e.opened_at and e.last_ts then c.escalated_at end,
       e.first_agent_reply_at, e.last_inbound_at, e.last_outbound_at,
       case when e.ep = e.last_ep and e.last_ts > now() - interval '24 hours' then null else e.last_ts end,
       case when e.ep = e.last_ep and e.last_ts > now() - interval '24 hours' then null else 'nao_classificado' end,
       case when e.ep = e.last_ep and e.last_ts > now() - interval '24 hours' then null else 'system' end
from episodes e
join twilio_conversations c on c.id = e.conversation_id
where e.opened_at is not null;

-- =====================================================================
-- 5. Views do Metabase (security_invoker, padrão de 20260918_metabase_bi_views)
-- Metas: bot <= 1 min · humano <= 15 min úteis · fechamento <= 24 h ·
-- taxa de fechamento >= 70% · taxa de agendamento >= 40%.
-- =====================================================================
create or replace view metabase_attendance_detail with (security_invoker = true) as
with base as (
  select
    a.*,
    coalesce(
      a.escalated_at,
      case when a.first_bot_reply_at is null then a.opened_at end
    ) as human_wait_start
  from conversation_attendances a
)
select
  b.id as attendance_id,
  b.clinic_id,
  b.conversation_id,
  b.kind,
  to_char(b.opened_at at time zone 'America/Belem', 'YYYY-MM') as mes,
  b.opened_at,
  b.closed_at,
  b.outcome,
  b.closed_by_kind,
  case
    when b.first_agent_reply_at is not null and b.first_bot_reply_at is not null then 'misto'
    when b.first_agent_reply_at is not null then 'humano'
    when b.first_bot_reply_at is not null then 'bot'
    else 'sem_resposta'
  end as handled_by,
  case when b.first_bot_reply_at >= b.opened_at
       then extract(epoch from (b.first_bot_reply_at - b.opened_at)) end as bot_primeira_resposta_seg,
  case when b.first_agent_reply_at >= b.human_wait_start
       then business_minutes_between(b.clinic_id, b.human_wait_start, b.first_agent_reply_at) end as humano_resposta_min_uteis,
  case when b.closed_at is not null and b.outcome in ('agendado','resolvido','perdido','spam')
       then extract(epoch from (b.closed_at - b.opened_at)) / 3600.0 end as horas_ate_fechamento,
  (b.closed_at is null and b.last_inbound_at > coalesce(b.last_outbound_at, '-infinity'::timestamptz)) as aguardando_clinica,
  (b.closed_at is null and b.escalated_at is not null and b.first_agent_reply_at is null) as aguardando_humano,
  60.0 as meta_bot_seg,
  15.0 as meta_humano_min_uteis,
  24.0 as meta_fechamento_horas
from base b;

create or replace view metabase_attendance_response_kpis with (security_invoker = true) as
with agg as (
  select
    clinic_id,
    mes,
    count(*) as atendimentos,
    (percentile_cont(0.5) within group (order by bot_primeira_resposta_seg))::numeric as bot_mediana_seg,
    (percentile_cont(0.9) within group (order by bot_primeira_resposta_seg))::numeric as bot_p90_seg,
    round(100.0 * count(*) filter (where bot_primeira_resposta_seg <= 60)
      / nullif(count(bot_primeira_resposta_seg), 0), 2) as bot_pct_dentro_meta,
    (percentile_cont(0.5) within group (order by humano_resposta_min_uteis))::numeric as humano_mediana_min_uteis,
    (percentile_cont(0.9) within group (order by humano_resposta_min_uteis))::numeric as humano_p90_min_uteis,
    round(100.0 * count(*) filter (where humano_resposta_min_uteis <= 15)
      / nullif(count(humano_resposta_min_uteis), 0), 2) as humano_pct_dentro_meta,
    (percentile_cont(0.5) within group (order by horas_ate_fechamento))::numeric as fechamento_mediana_horas,
    round(100.0 * count(*) filter (where horas_ate_fechamento <= 24)
      / nullif(count(horas_ate_fechamento), 0), 2) as fechamento_pct_dentro_meta
  from metabase_attendance_detail
  group by clinic_id, mes
)
select
  agg.clinic_id,
  agg.mes,
  agg.atendimentos,
  round(agg.bot_mediana_seg::numeric, 1) as bot_mediana_seg_atual,
  round((lag(agg.bot_mediana_seg) over w)::numeric, 1) as bot_mediana_seg_mes_anterior,
  round(100.0 * (agg.bot_mediana_seg - lag(agg.bot_mediana_seg) over w)
    / nullif(lag(agg.bot_mediana_seg) over w, 0), 2) as bot_variacao_mom_pct,
  round(agg.bot_p90_seg::numeric, 1) as bot_p90_seg,
  agg.bot_pct_dentro_meta,
  60.0 as bot_meta_seg,
  round(agg.humano_mediana_min_uteis::numeric, 1) as humano_mediana_min_atual,
  round((lag(agg.humano_mediana_min_uteis) over w)::numeric, 1) as humano_mediana_min_mes_anterior,
  round(100.0 * (agg.humano_mediana_min_uteis - lag(agg.humano_mediana_min_uteis) over w)
    / nullif(lag(agg.humano_mediana_min_uteis) over w, 0), 2) as humano_variacao_mom_pct,
  round(agg.humano_p90_min_uteis::numeric, 1) as humano_p90_min_uteis,
  agg.humano_pct_dentro_meta,
  15.0 as humano_meta_min_uteis,
  round(agg.fechamento_mediana_horas::numeric, 1) as fechamento_mediana_horas_atual,
  round((lag(agg.fechamento_mediana_horas) over w)::numeric, 1) as fechamento_mediana_horas_mes_anterior,
  round(100.0 * (agg.fechamento_mediana_horas - lag(agg.fechamento_mediana_horas) over w)
    / nullif(lag(agg.fechamento_mediana_horas) over w, 0), 2) as fechamento_variacao_mom_pct,
  agg.fechamento_pct_dentro_meta,
  24.0 as fechamento_meta_horas
from agg
window w as (partition by agg.clinic_id order by agg.mes);

create or replace view metabase_attendance_closure_kpis with (security_invoker = true) as
with agg as (
  select
    clinic_id,
    mes,
    count(*) as atendimentos,
    count(*) filter (where closed_at is null) as em_aberto,
    count(*) filter (where outcome = 'agendado') as agendados,
    count(*) filter (where outcome = 'resolvido') as resolvidos,
    count(*) filter (where outcome = 'resolvido' and handled_by = 'bot') as resolvidos_so_bot,
    count(*) filter (where outcome = 'perdido') as perdidos,
    count(*) filter (where outcome = 'sem_retorno') as sem_retorno,
    count(*) filter (where outcome = 'spam') as spam,
    count(*) filter (where outcome = 'nao_classificado') as nao_classificados,
    count(*) filter (where outcome in ('agendado','resolvido','perdido','sem_retorno')) as classificaveis
  from metabase_attendance_detail
  group by clinic_id, mes
),
rates as (
  select agg.*,
    round(100.0 * (agendados + resolvidos) / nullif(classificaveis, 0), 2) as taxa_fechamento_pct,
    round(100.0 * agendados / nullif(classificaveis, 0), 2) as taxa_agendamento_pct,
    round(100.0 * resolvidos_so_bot / nullif(classificaveis, 0), 2) as taxa_resolvido_bot_pct
  from agg
)
select
  r.clinic_id,
  r.mes,
  r.atendimentos,
  r.em_aberto,
  r.agendados,
  r.resolvidos,
  r.resolvidos_so_bot,
  r.perdidos,
  r.sem_retorno,
  r.spam,
  r.nao_classificados,
  r.classificaveis,
  r.taxa_fechamento_pct as taxa_fechamento_atual_pct,
  lag(r.taxa_fechamento_pct) over w as taxa_fechamento_mes_anterior_pct,
  round(r.taxa_fechamento_pct - lag(r.taxa_fechamento_pct) over w, 2) as taxa_fechamento_variacao_pp,
  70.00 as taxa_fechamento_meta_pct,
  r.taxa_agendamento_pct as taxa_agendamento_atual_pct,
  lag(r.taxa_agendamento_pct) over w as taxa_agendamento_mes_anterior_pct,
  round(r.taxa_agendamento_pct - lag(r.taxa_agendamento_pct) over w, 2) as taxa_agendamento_variacao_pp,
  40.00 as taxa_agendamento_meta_pct,
  r.taxa_resolvido_bot_pct as taxa_resolvido_bot_atual_pct,
  lag(r.taxa_resolvido_bot_pct) over w as taxa_resolvido_bot_mes_anterior_pct
from rates r
window w as (partition by r.clinic_id order by r.mes);
