-- Função central de cálculo de "Módulo Assistencial" (cláusula 6ª do
-- contrato-quadro PJ–PJ). Fonte de verdade única, chamada tanto pelo
-- fechamento mensal (close_monthly_payouts_for_month) quanto pelas telas
-- ao vivo (gestor/financeiro, terapeuta/repasse) — elimina a duplicação de
-- lógica que existia entre close_monthly_payouts() (SQL) e closePayouts()
-- (TS) no modelo antigo por hora.
--
-- Módulo = atendimentos de um mesmo terapeuta, mesmo dia (fuso
-- America/Sao_Paulo), mesmo período (matutino: hora local < 12; vespertino:
-- >= 12), particionados em blocos de `attendances_per_module` (resolvido
-- pelo contrato vigente na data do primeiro atendimento do bloco). Só
-- entram no agrupamento atendimentos 'realizada' ou 'falta_familia' —
-- cancelamentos/remarcações não "ocupam" o módulo (não foram alocados de
-- fato). Regra "tudo ou nada" por módulo:
--   delivered = todos 'realizada' E todos com pelo menos 1 session_notes
--     (prontuário) — a "entrega/protocolo de documentação" (cláusula
--     6.1-iii) é derivada automaticamente da existência de prontuário, sem
--     tela de "protocolar" separada (decisão de produto 2026-09-10).
--   emptied_by_noshow = todos 'falta_familia' com cancelled_at preenchido e
--     aviso < 24h antes do início (mesmo padrão de "aviso curto" já usado
--     em métricas de cancelamento).
-- Qualquer outra combinação (misto realizada/falta, falta com aviso >=24h,
-- módulo incompleto) não é nem entregue nem indenizável — nada devido
-- (cláusula 6.6: "não entrega ⇒ nada devido").
--
-- security invoker (padrão) de propósito: respeita a RLS já existente de
-- appointments/session_notes/therapist_contracts — mesma visibilidade que
-- as telas já tinham antes desta migration, sem elevar privilégio.
create or replace function compute_assistance_modules(
  p_therapist_ids uuid[],
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns table (
  therapist_id uuid,
  service_date date,
  period text,
  module_index int,
  attendance_count int,
  delivered boolean,
  emptied_by_noshow boolean,
  appointment_ids uuid[]
)
language sql
stable
as $$
  with base as (
    select
      a.id,
      a.therapist_id,
      a.status,
      a.starts_at,
      a.cancelled_at,
      (a.starts_at at time zone 'America/Sao_Paulo')::date as service_date,
      case
        when extract(hour from a.starts_at at time zone 'America/Sao_Paulo') < 12 then 'matutino'
        else 'vespertino'
      end as period,
      coalesce((
        select c.attendances_per_module
        from therapist_contracts c
        where c.profile_id = a.therapist_id
          and c.valid_from <= a.starts_at
          and (c.valid_to is null or c.valid_to >= a.starts_at)
        limit 1
      ), 6) as attendances_per_module
    from appointments a
    where a.therapist_id = any(p_therapist_ids)
      and a.starts_at >= p_period_start
      and a.starts_at < p_period_end
      and a.status in ('realizada', 'falta_familia')
  ),
  partitioned as (
    select
      base.*,
      (row_number() over (partition by therapist_id, service_date, period order by starts_at) - 1)
        / attendances_per_module as module_index
    from base
  )
  select
    p.therapist_id,
    p.service_date,
    p.period,
    p.module_index,
    count(*)::int as attendance_count,
    bool_and(p.status = 'realizada')
      and bool_and(exists (select 1 from session_notes sn where sn.appointment_id = p.id))
      as delivered,
    bool_and(
      p.status = 'falta_familia'
      and p.cancelled_at is not null
      and p.starts_at - p.cancelled_at < interval '24 hours'
    ) as emptied_by_noshow,
    array_agg(p.id order by p.starts_at) as appointment_ids
  from partitioned p
  group by p.therapist_id, p.service_date, p.period, p.module_index;
$$;

revoke all on function compute_assistance_modules(uuid[], timestamptz, timestamptz) from public;
grant execute on function compute_assistance_modules(uuid[], timestamptz, timestamptz) to authenticated;
