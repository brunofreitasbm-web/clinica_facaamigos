-- supabase/migrations/20260905150000_metric_snapshots_expand.sql
--
-- Amplia close_monthly_metric_snapshots (20260904000027/29) para cobrir mais
-- métricas do §10 do PRD. Antes desta migration só 3 de ~32 metric_key
-- tinham pipeline de cálculo (no_show_rate, occupancy_rate, glosa_rate,
-- todas escopo 'clinica'). Esta migration adiciona:
--
-- Escopo 'clinica': no_auth_sessions, confirm_d1_rate, clinic_cancel_rate,
-- churn_rate, queue_days, glosa_recovery, batch_lead_days, dso_days,
-- first_response_min, recovery_rate, lead_to_eval_rate, eval_show_rate.
--
-- Escopo 'profile' (por terapeuta, loop dentro do loop de clínica):
-- note_24h_rate, therapist_cancel_rate, data_collection_rate,
-- attributable_glosa.
--
-- Fora desta migration (ficam para quando o produto decidir a definição
-- exata): intake_complete_rate (não há checklist de documentos formalizado),
-- room_occupancy (não há agenda-base de sala cadastrada), auth_first_pass e
-- review_on_time (não há marcação de reenvio de autorização nem prazo de
-- entrega de reavaliação no schema), report_on_time/retention_90d/
-- goal_progress/family_nps (dependem de decisão de produto sobre janela e
-- vínculo terapeuta↔pergunta de NPS), e todo o painel executivo do gestor
-- (§10.5) que já é recalculado ao vivo em app/gestor/inteligencia.
--
-- Aproximações assumidas (documentadas aqui por não caberem em comentário de
-- coluna):
--  - lead_to_eval_rate/eval_show_rate usam o status ATUAL do paciente (não
--    reconstroem o histórico via audit_log como patient_status_as_of faz
--    para churn_rate) — como o fluxo de estágio é sequencial e não permite
--    voltar de 'avaliacao' para 'lead' (app/recepcao/pacientes/[id]/stage-actions.ts),
--    "status atual ≠ lead" é equivalente a "alguma vez chegou a avaliação"
--    para o cohort de leads criados no período.
--  - recovery_rate considera recuperada a falta/cancelamento familiar cujo
--    paciente teve uma sessão `realizada` nos 7 dias seguintes — não exige
--    que a nova sessão seja a reposição formal daquele agendamento
--    específico (o schema não amarra appointments de reposição ao original).
--  - dso_days usa billing_periods.exported_at como proxy de "data de envio"
--    (mesma aproximação já usada em app/gestor/financeiro/data.ts).
--
-- Validado contra o banco real (vththexblpxwocbowhsv) rodando cada bloco de
-- SELECT isoladamente antes de aplicar, e a função inteira depois — sem
-- erro, sem duplicar linha ao rodar 2x (unique index já existe desde 000027).

create function upsert_metric_snapshot(
  p_metric_key text,
  p_scope_type text,
  p_scope_id uuid,
  p_period_start date,
  p_period_end date,
  p_value numeric
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_value is null then
    return;
  end if;
  insert into metric_snapshots (metric_key, scope_type, scope_id, period_start, period_end, value)
  values (p_metric_key, p_scope_type, p_scope_id, p_period_start, p_period_end, p_value)
  on conflict (metric_key, scope_type, scope_id, period_start)
  do update set value = excluded.value, period_end = excluded.period_end, computed_at = now();
end;
$$;

revoke execute on function upsert_metric_snapshot(text, text, uuid, date, date, numeric) from public, anon, authenticated;

create or replace function close_monthly_metric_snapshots() returns void
language plpgsql security definer set search_path = public as $$
declare
  clinic_row record;
  therapist_row record;
  v_period_start date := date_trunc('month', now() - interval '1 month')::date;
  v_period_end date := date_trunc('month', now())::date;

  -- agregados de appointments em escopo clínica (uma única passada)
  denom_count bigint;
  falta_count bigint;
  scheduled_hours numeric;
  realized_hours numeric;
  cancel_clinic_num bigint;
  denom_scheduled bigint;
  confirmed_d1_num bigint;
  realizada_count bigint;
  no_auth_num bigint;

  -- recovery_rate (precisa de subquery correlacionada, consulta à parte)
  faltas_base bigint;
  faltas_recuperadas bigint;

  -- churn_rate (via audit_log / patient_status_as_of)
  ativos_inicio bigint;
  evadidos_mes bigint;

  -- lead_to_eval_rate / eval_show_rate
  leads_periodo bigint;
  leads_avaliacao bigint;
  leads_evaluated bigint;

  -- glosa_recovery / batch_lead_days / dso_days
  glosado_amount numeric;
  glosa_recovered numeric;

  -- por terapeuta
  t_realizada bigint;
  t_note24_ok bigint;
  t_denom bigint;
  t_cancel_num bigint;
  t_data_collect_num bigint;
  t_billed numeric;
  t_glosa_attr numeric;
begin
  for clinic_row in select id from clinics loop

    -- ── Agregados de appointments do mês, escopo clínica ────────────────
    select
      count(*) filter (where a.status in ('realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica')),
      count(*) filter (where a.status = 'falta_familia'),
      coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 3600.0)
        filter (where a.status in ('realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica')), 0),
      coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 3600.0)
        filter (where a.status = 'realizada'), 0),
      count(*) filter (where a.status in ('cancelada_clinica','cancelada_terapeuta')),
      count(*),
      count(*) filter (where a.confirmed_at is not null and a.confirmed_at <= a.starts_at - interval '1 day'),
      count(*) filter (where a.status = 'realizada'),
      count(*) filter (where a.status = 'realizada' and a.authorization_id is null)
    into denom_count, falta_count, scheduled_hours, realized_hours, cancel_clinic_num,
         denom_scheduled, confirmed_d1_num, realizada_count, no_auth_num
    from appointments a
    join patients p on p.id = a.patient_id
    where p.clinic_id = clinic_row.id
      and a.starts_at >= v_period_start and a.starts_at < v_period_end;

    perform upsert_metric_snapshot('no_show_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when denom_count > 0 then falta_count::numeric / denom_count else null end);
    perform upsert_metric_snapshot('occupancy_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when scheduled_hours > 0 then realized_hours / scheduled_hours else null end);
    perform upsert_metric_snapshot('clinic_cancel_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when denom_count > 0 then cancel_clinic_num::numeric / denom_count else null end);
    perform upsert_metric_snapshot('confirm_d1_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when denom_scheduled > 0 then confirmed_d1_num::numeric / denom_scheduled else null end);
    perform upsert_metric_snapshot('no_auth_sessions', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when realizada_count > 0 then no_auth_num::numeric / realizada_count else null end);

    -- ── recovery_rate: falta/cancelamento familiar com sessão realizada em até 7 dias depois ──
    select
      count(*),
      count(*) filter (where exists (
        select 1 from appointments a2
        where a2.patient_id = a.patient_id
          and a2.status = 'realizada'
          and a2.starts_at > a.starts_at
          and a2.starts_at <= a.starts_at + interval '7 days'
      ))
    into faltas_base, faltas_recuperadas
    from appointments a
    join patients p on p.id = a.patient_id
    where p.clinic_id = clinic_row.id
      and a.starts_at >= v_period_start and a.starts_at < v_period_end
      and a.status in ('falta_familia', 'cancelada_familia');

    perform upsert_metric_snapshot('recovery_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when faltas_base > 0 then faltas_recuperadas::numeric / faltas_base else null end);

    -- ── churn_rate: ativos no início do mês → evadido durante o mês (audit_log) ──
    select count(*) into ativos_inicio
    from patients p
    where p.clinic_id = clinic_row.id
      and patient_status_as_of(p.id, v_period_start::timestamptz) = 'ativo';

    select count(distinct al.row_id) into evadidos_mes
    from audit_log al
    where al.table_name = 'patients'
      and al.clinic_id = clinic_row.id
      and al.at >= v_period_start and al.at < v_period_end
      and (al.after ->> 'status') = 'evadido';

    perform upsert_metric_snapshot('churn_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when ativos_inicio > 0 then evadidos_mes::numeric / ativos_inicio else null end);

    -- ── queue_days: mediana de dias entre avaliação realizada e 1ª sessão ──
    perform upsert_metric_snapshot('queue_days', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (p.first_session_at - p.evaluated_at)) / 86400.0
       )::numeric
       from patients p
       where p.clinic_id = clinic_row.id
         and p.first_session_at >= v_period_start and p.first_session_at < v_period_end
         and p.evaluated_at is not null));

    -- ── first_response_min: mediana de minutos entre criação do lead e 1º contato ──
    perform upsert_metric_snapshot('first_response_min', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (p.first_contact_at - p.created_at)) / 60.0
       )::numeric
       from patients p
       where p.clinic_id = clinic_row.id
         and p.created_at >= v_period_start and p.created_at < v_period_end
         and p.first_contact_at is not null));

    -- ── lead_to_eval_rate / eval_show_rate: cohort de leads criados no mês ──
    select
      count(*),
      count(*) filter (where p.status <> 'lead'),
      count(*) filter (where p.evaluated_at is not null)
    into leads_periodo, leads_avaliacao, leads_evaluated
    from patients p
    where p.clinic_id = clinic_row.id
      and p.created_at >= v_period_start and p.created_at < v_period_end;

    perform upsert_metric_snapshot('lead_to_eval_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when leads_periodo > 0 then leads_avaliacao::numeric / leads_periodo else null end);
    perform upsert_metric_snapshot('eval_show_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when leads_avaliacao > 0 then leads_evaluated::numeric / leads_avaliacao else null end);

    -- ── glosa_rate / glosa_recovery: competência de faturamento = mês fechado ──
    select
      coalesce(sum(bi.amount), 0),
      coalesce(sum(bi.amount) filter (where bi.status = 'glosado'), 0)
    into scheduled_hours, realized_hours -- reaproveita variáveis numeric já livres neste ponto do bloco
    from billing_items bi
    join billing_periods bp on bp.id = bi.billing_period_id
    join insurers i on i.id = bp.insurer_id
    where i.clinic_id = clinic_row.id
      and bp.competence_month = v_period_start;

    perform upsert_metric_snapshot('glosa_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when scheduled_hours > 0 then realized_hours / scheduled_hours else null end);

    select
      coalesce(sum(g.amount), 0),
      coalesce(sum(g.recovered_amount), 0)
    into glosado_amount, glosa_recovered
    from glosas g
    join billing_items bi on bi.id = g.billing_item_id
    join billing_periods bp on bp.id = bi.billing_period_id
    join insurers i on i.id = bp.insurer_id
    where i.clinic_id = clinic_row.id
      and bp.competence_month = v_period_start;

    perform upsert_metric_snapshot('glosa_recovery', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when glosado_amount > 0 then glosa_recovered / glosado_amount else null end);

    -- ── batch_lead_days: dias entre fim da competência e exported_at ──
    perform upsert_metric_snapshot('batch_lead_days', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (bp.exported_at - (bp.competence_month + interval '1 month'))) / 86400.0
       )::numeric
       from billing_periods bp
       join insurers i on i.id = bp.insurer_id
       where i.clinic_id = clinic_row.id
         and bp.competence_month = v_period_start
         and bp.exported_at is not null));

    -- ── dso_days: dias entre envio (exported_at) e pagamento (paid_at) ──
    perform upsert_metric_snapshot('dso_days', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (bi.paid_at - bp.exported_at)) / 86400.0
       )::numeric
       from billing_items bi
       join billing_periods bp on bp.id = bi.billing_period_id
       join insurers i on i.id = bp.insurer_id
       where i.clinic_id = clinic_row.id
         and bp.competence_month = v_period_start
         and bi.paid_at is not null
         and bp.exported_at is not null));

    -- ── Por terapeuta (escopo 'profile') ────────────────────────────────
    for therapist_row in
      select id from profiles where clinic_id = clinic_row.id and role = 'terapeuta' and active
    loop
      select
        count(*) filter (where a.status = 'realizada'),
        count(*) filter (where a.status = 'realizada' and exists (
          select 1 from session_notes sn
          where sn.appointment_id = a.id and sn.created_at_server <= a.ends_at + interval '24 hours'
        )),
        count(*) filter (where a.status in ('realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica')),
        count(*) filter (where a.status = 'cancelada_terapeuta' and a.cancelled_at is not null and a.starts_at - a.cancelled_at < interval '24 hours'),
        count(*) filter (where a.status = 'realizada' and exists (
          select 1 from trial_data td where td.appointment_id = a.id
        ))
      into t_realizada, t_note24_ok, t_denom, t_cancel_num, t_data_collect_num
      from appointments a
      where a.therapist_id = therapist_row.id
        and a.starts_at >= v_period_start and a.starts_at < v_period_end;

      perform upsert_metric_snapshot('note_24h_rate', 'profile', therapist_row.id, v_period_start, v_period_end,
        case when t_realizada > 0 then t_note24_ok::numeric / t_realizada else null end);
      perform upsert_metric_snapshot('therapist_cancel_rate', 'profile', therapist_row.id, v_period_start, v_period_end,
        case when t_denom > 0 then t_cancel_num::numeric / t_denom else null end);
      perform upsert_metric_snapshot('data_collection_rate', 'profile', therapist_row.id, v_period_start, v_period_end,
        case when t_realizada > 0 then t_data_collect_num::numeric / t_realizada else null end);

      select coalesce(sum(bi.amount), 0) into t_billed
      from billing_items bi
      join billing_periods bp on bp.id = bi.billing_period_id
      join appointments a on a.id = bi.appointment_id
      where a.therapist_id = therapist_row.id and bp.competence_month = v_period_start;

      select coalesce(sum(g.amount), 0) into t_glosa_attr
      from glosas g
      join billing_items bi on bi.id = g.billing_item_id
      join billing_periods bp on bp.id = bi.billing_period_id
      join appointments a on a.id = bi.appointment_id
      where a.therapist_id = therapist_row.id
        and bp.competence_month = v_period_start
        and g.attributable_to = 'terapeuta'
        and g.attributable_profile_id = therapist_row.id;

      perform upsert_metric_snapshot('attributable_glosa', 'profile', therapist_row.id, v_period_start, v_period_end,
        case when t_billed > 0 then t_glosa_attr / t_billed else null end);
    end loop;

  end loop;
end;
$$;

revoke execute on function close_monthly_metric_snapshots() from public, anon, authenticated;
