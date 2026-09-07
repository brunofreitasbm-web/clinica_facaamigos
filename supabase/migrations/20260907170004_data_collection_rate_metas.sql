-- supabase/migrations/20260907170004_data_collection_rate_metas.sql
-- PRD §10.3 define data_collection_rate como "sessões com ≥ 1 trial_data OU
-- metas marcadas ÷ realizadas". Até aqui só trial_data contava — metas
-- trabalhadas (structured->'metas_trabalhadas', ver lib/session-note-fields.ts)
-- nunca entravam na conta, então uma disciplina que só registra metas (sem
-- trial-by-trial) aparecia com data_collection_rate zerado mesmo coletando
-- dado todo atendimento.
--
-- close_monthly_metric_snapshots é um `create or replace` de corpo inteiro,
-- redefinido a cada migration que a toca (a mais recente:
-- 20260907000002_rename_pdi_pei_to_pts.sql). Este arquivo copia esse corpo
-- LITERALMENTE e altera só o filtro de t_data_collect_num — qualquer outra
-- base silenciosamente reverteria pts_50d_rate, review_on_time, atribuição
-- de glosa e as métricas de repasse.
--
-- O literal 'metas_trabalhadas' abaixo é metade do contrato descrito em
-- lib/session-note-fields.ts (SESSION_NOTE_METAS_KEY); a outra metade é
-- fixada por tests/session-note-contract.test.ts, que lê este arquivo do
-- disco e falha se a chave mudar de um lado sem mudar do outro.
create or replace function close_monthly_metric_snapshots() returns void
language plpgsql security definer set search_path = public as $$
declare
  clinic_row record;
  therapist_row record;
  v_period_start date := date_trunc('month', now() - interval '1 month')::date;
  v_period_end date := date_trunc('month', now())::date;

  denom_count bigint; falta_count bigint; scheduled_hours numeric; realized_hours numeric;
  cancel_clinic_num bigint; denom_scheduled bigint; confirmed_d1_num bigint; realizada_count bigint; no_auth_num bigint;
  faltas_base bigint; faltas_recuperadas bigint;
  ativos_inicio bigint; evadidos_mes bigint;
  interessados_periodo bigint; interessados_avaliacao bigint; interessados_evaluated bigint;
  glosado_amount numeric; glosa_recovered numeric;
  t_realizada bigint; t_note24_ok bigint; t_denom bigint; t_cancel_num bigint; t_data_collect_num bigint;
  t_billed numeric; t_glosa_attr numeric;

  anamneses_periodo bigint; anamneses_on_time bigint;
  active_patients bigint; active_with_protocol bigint;
  plans_total bigint; plans_reviewed bigint;
  reassessments_due bigint; reassessments_on_time bigint;
  pts_periodo bigint; pts_on_time bigint;
begin
  for clinic_row in select id from clinics loop

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

    select
      count(*),
      count(*) filter (where exists (
        select 1 from appointments a2
        where a2.patient_id = a.patient_id and a2.status = 'realizada'
          and a2.starts_at > a.starts_at and a2.starts_at <= a.starts_at + interval '7 days'
      ))
    into faltas_base, faltas_recuperadas
    from appointments a
    join patients p on p.id = a.patient_id
    where p.clinic_id = clinic_row.id
      and a.starts_at >= v_period_start and a.starts_at < v_period_end
      and a.status in ('falta_familia', 'cancelada_familia');

    perform upsert_metric_snapshot('recovery_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when faltas_base > 0 then faltas_recuperadas::numeric / faltas_base else null end);

    select count(*) into ativos_inicio
    from patients p
    where p.clinic_id = clinic_row.id and patient_status_as_of(p.id, v_period_start::timestamptz) = 'ativo';

    select count(distinct al.row_id) into evadidos_mes
    from audit_log al
    where al.table_name = 'patients' and al.clinic_id = clinic_row.id
      and al.at >= v_period_start and al.at < v_period_end
      and (al.after ->> 'status') = 'evadido';

    perform upsert_metric_snapshot('churn_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when ativos_inicio > 0 then evadidos_mes::numeric / ativos_inicio else null end);

    perform upsert_metric_snapshot('queue_days', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (p.first_session_at - p.evaluated_at)) / 86400.0)::numeric
       from patients p
       where p.clinic_id = clinic_row.id
         and p.first_session_at >= v_period_start and p.first_session_at < v_period_end
         and p.evaluated_at is not null));

    perform upsert_metric_snapshot('first_response_min', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (p.first_contact_at - p.created_at)) / 60.0)::numeric
       from patients p
       where p.clinic_id = clinic_row.id
         and p.created_at >= v_period_start and p.created_at < v_period_end
         and p.first_contact_at is not null));

    select
      count(*), count(*) filter (where p.status <> 'interessado'), count(*) filter (where p.evaluated_at is not null)
    into interessados_periodo, interessados_avaliacao, interessados_evaluated
    from patients p
    where p.clinic_id = clinic_row.id and p.created_at >= v_period_start and p.created_at < v_period_end;

    perform upsert_metric_snapshot('interessado_to_eval_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when interessados_periodo > 0 then interessados_avaliacao::numeric / interessados_periodo else null end);
    perform upsert_metric_snapshot('eval_show_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when interessados_avaliacao > 0 then interessados_evaluated::numeric / interessados_avaliacao else null end);

    select coalesce(sum(bi.amount), 0), coalesce(sum(bi.amount) filter (where bi.status = 'glosado'), 0)
    into scheduled_hours, realized_hours
    from billing_items bi
    join billing_periods bp on bp.id = bi.billing_period_id
    join insurers i on i.id = bp.insurer_id
    where i.clinic_id = clinic_row.id and bp.competence_month = v_period_start;

    perform upsert_metric_snapshot('glosa_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when scheduled_hours > 0 then realized_hours / scheduled_hours else null end);

    select coalesce(sum(g.amount), 0), coalesce(sum(g.recovered_amount), 0)
    into glosado_amount, glosa_recovered
    from glosas g
    join billing_items bi on bi.id = g.billing_item_id
    join billing_periods bp on bp.id = bi.billing_period_id
    join insurers i on i.id = bp.insurer_id
    where i.clinic_id = clinic_row.id and bp.competence_month = v_period_start;

    perform upsert_metric_snapshot('glosa_recovery', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when glosado_amount > 0 then glosa_recovered / glosado_amount else null end);

    perform upsert_metric_snapshot('batch_lead_days', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (bp.exported_at - (bp.competence_month + interval '1 month'))) / 86400.0)::numeric
       from billing_periods bp
       join insurers i on i.id = bp.insurer_id
       where i.clinic_id = clinic_row.id and bp.competence_month = v_period_start and bp.exported_at is not null));

    perform upsert_metric_snapshot('dso_days', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (bi.paid_at - bp.exported_at)) / 86400.0)::numeric
       from billing_items bi
       join billing_periods bp on bp.id = bi.billing_period_id
       join insurers i on i.id = bp.insurer_id
       where i.clinic_id = clinic_row.id and bp.competence_month = v_period_start
         and bi.paid_at is not null and bp.exported_at is not null));

    -- ── intake_60d_rate (slide 39, meta ≥95%) ──────────────────────────
    select count(*),
      count(*) filter (where exists (
        select 1 from treatment_plans tp
        where tp.patient_id = an.patient_id and tp.delivered_at is not null
          and tp.delivered_at <= an.conducted_at + interval '60 days'
      ))
    into anamneses_periodo, anamneses_on_time
    from anamneses an
    join patients p on p.id = an.patient_id
    where p.clinic_id = clinic_row.id
      and an.conducted_at >= v_period_start and an.conducted_at < v_period_end;

    perform upsert_metric_snapshot('intake_60d_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when anamneses_periodo > 0 then anamneses_on_time::numeric / anamneses_periodo else null end);

    -- ── pts_50d_rate (Boaspraticas.md §2.3, prazo interno de 50 dias) ──
    -- Mesma cohort de intake_60d_rate (anamneses do mês), numerador =
    -- paciente com treatment_plan aprovado pela supervisão (approved_by)
    -- em até 50 dias da anamnese.
    select count(*),
      count(*) filter (where exists (
        select 1 from treatment_plans tp
        where tp.patient_id = an.patient_id and tp.approved_by is not null
          and tp.approved_at is not null and tp.approved_at <= an.conducted_at + interval '50 days'
      ))
    into pts_periodo, pts_on_time
    from anamneses an
    join patients p on p.id = an.patient_id
    where p.clinic_id = clinic_row.id
      and an.conducted_at >= v_period_start and an.conducted_at < v_period_end;

    perform upsert_metric_snapshot('pts_50d_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when pts_periodo > 0 then pts_on_time::numeric / pts_periodo else null end);

    -- ── protocol_coverage_rate (slide 39, meta 100%) ───────────────────
    select count(*), count(*) filter (where exists (
        select 1 from protocol_assessments pa where pa.patient_id = p.id
      ))
    into active_patients, active_with_protocol
    from patients p
    where p.clinic_id = clinic_row.id and p.status = 'ativo';

    perform upsert_metric_snapshot('protocol_coverage_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when active_patients > 0 then active_with_protocol::numeric / active_patients else null end);

    -- ── plan_reviewed_rate (slide 39, meta 100%) ───────────────────────
    select count(*), count(*) filter (where tp.approved_by is not null)
    into plans_total, plans_reviewed
    from treatment_plans tp
    join patients p on p.id = tp.patient_id
    where p.clinic_id = clinic_row.id;

    perform upsert_metric_snapshot('plan_reviewed_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when plans_total > 0 then plans_reviewed::numeric / plans_total else null end);

    -- ── review_on_time / reavaliações em dia (slide 39, meta ≥90%) ─────
    select count(*), count(*) filter (where ra.status = 'concluido')
    into reassessments_due, reassessments_on_time
    from reassessment_alerts ra
    join patients p on p.id = ra.patient_id
    where p.clinic_id = clinic_row.id
      and ra.due_date >= v_period_start and ra.due_date < v_period_end;

    perform upsert_metric_snapshot('review_on_time', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when reassessments_due > 0 then reassessments_on_time::numeric / reassessments_due else null end);

    for therapist_row in
      select id from profiles where clinic_id = clinic_row.id and role = 'terapeuta' and active
    loop
      select
        count(*) filter (where a.status = 'realizada'),
        count(*) filter (where a.status = 'realizada' and exists (
          select 1 from session_notes sn where sn.appointment_id = a.id and sn.created_at_server <= a.ends_at + interval '24 hours'
        )),
        count(*) filter (where a.status in ('realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica')),
        count(*) filter (where a.status = 'cancelada_terapeuta' and a.cancelled_at is not null and a.starts_at - a.cancelled_at < interval '24 hours'),
        count(*) filter (where a.status = 'realizada' and (
          exists (select 1 from trial_data td where td.appointment_id = a.id)
          or exists (
            select 1 from session_notes sn
            where sn.appointment_id = a.id
              and jsonb_array_length(coalesce(sn.structured->'metas_trabalhadas','[]'::jsonb)) > 0
          )
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
      where a.therapist_id = therapist_row.id and bp.competence_month = v_period_start
        and g.attributable_to = 'terapeuta' and g.attributable_profile_id = therapist_row.id;

      perform upsert_metric_snapshot('attributable_glosa', 'profile', therapist_row.id, v_period_start, v_period_end,
        case when t_billed > 0 then t_glosa_attr / t_billed else null end);
    end loop;

  end loop;
end;
$$;

revoke execute on function close_monthly_metric_snapshots() from public, anon, authenticated;
