-- supabase/migrations/20260910071000_intake_complete_rate_metric.sql
-- Troca a meta operacional da recepção no PLR: sai `no_show_rate`, entra
-- `intake_complete_rate` (cadastro completo antes da 1ª sessão).
--
-- Por quê: no-show mede o que a FAMÍLIA fez, não o que a recepção fez, e a
-- clínica não faz reagendamento/reposição de falta (ver
-- 20260909210000_update_absence_message_template.sql e
-- 20260909230000_drop_recovery_rate_metric.sql). Sem reposição, a recepção
-- não tem nenhuma alavanca sobre a falta depois que ela acontece — a meta
-- premiava/punia sorte. O checklist de entrada, ao contrário, é 100%
-- trabalho de balcão e tem consequência direta no faturamento (pedido médico
-- com CID e carteirinha) e no jurídico (LGPD, imagem, contrato).
--
-- `no_show_rate` CONTINUA sendo calculado e continua no painel do gestor: é
-- um monitor legítimo de operação da clínica (alimenta a leitura de evasão e
-- ocupação). O que muda é que ele deixa de ser meta de bonificação de cargo.
-- Por isso aqui só se apagam as metas cadastradas, não os snapshots.
--
-- close_monthly_metric_snapshots é `create or replace` de corpo inteiro,
-- redefinido a cada migration que o toca (o mais recente:
-- 20260909230000_drop_recovery_rate_metric.sql). Este arquivo copia esse
-- corpo LITERALMENTE e apenas ACRESCENTA o bloco de intake_complete_rate —
-- qualquer outra base reverteria silenciosamente as métricas do RT, de
-- repasse e a remoção de recovery_rate.

create or replace function close_monthly_metric_snapshots() returns void
language plpgsql security definer set search_path = public as $$
declare
  clinic_row record;
  therapist_row record;
  v_period_start date := date_trunc('month', now() - interval '1 month')::date;
  v_period_end date := date_trunc('month', now())::date;

  denom_count bigint; falta_count bigint; scheduled_hours numeric; realized_hours numeric;
  cancel_clinic_num bigint; denom_scheduled bigint; confirmed_d1_num bigint; realizada_count bigint; no_auth_num bigint;
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

  first_session_patients bigint; intake_complete_patients bigint;
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


    -- ── intake_complete_rate (§10.1, checklist de entrada) ─────────────
    -- Entra no lugar de no_show_rate como meta de PLR da recepção: falta é
    -- comportamento da família e a clínica não faz reposição
    -- (20260909230000_drop_recovery_rate_metric.sql), então o balcão não
    -- tinha alavanca sobre a meta antiga. O checklist de entrada é trabalho
    -- de recepção do começo ao fim — as 6 categorias vêm de
    -- 20260906000006_intake_documents.sql e de
    -- app/recepcao/checklist-entrada-dialog.tsx, nesta ordem:
    -- pedido médico c/ CID, carteirinha, documento do responsável,
    -- termo LGPD, termo de imagem, contrato.
    --
    -- Denominador: pacientes cuja 1ª sessão caiu no mês. Numerador: os que
    -- tinham os documentos anexados ANTES da 1ª sessão (uploaded_at <=
    -- first_session_at) — anexar depois não conta, senão a métrica premiaria
    -- justamente o cadastro que atrasou. Carteirinha só é cobrada de quem
    -- tem convênio: particular sem carteirinha não é cadastro incompleto.
    select
      count(*),
      count(*) filter (
        where (
          select count(distinct d.category)
          from documents d
          where d.patient_id = p.id
            and d.uploaded_at <= p.first_session_at
            and d.category in ('pedido_medico','documento_responsavel','termo_lgpd','termo_imagem','contrato')
        ) = 5
        and (
          not exists (
            select 1 from patient_insurance pi
            where pi.patient_id = p.id and pi.is_private = false
          )
          or exists (
            select 1 from documents d
            where d.patient_id = p.id and d.category = 'carteirinha'
              and d.uploaded_at <= p.first_session_at
          )
        )
      )
    into first_session_patients, intake_complete_patients
    from patients p
    where p.clinic_id = clinic_row.id
      and p.first_session_at >= v_period_start and p.first_session_at < v_period_end;

    perform upsert_metric_snapshot('intake_complete_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when first_session_patients > 0 then intake_complete_patients::numeric / first_session_patients else null end);

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

-- Metas de PLR já cadastradas na métrica extinta para a recepção: sem meta
-- não há linha no ponderado (lib/bonus-simulation.ts ignora métrica sem
-- item), e deixar a linha viva faria a recepção continuar sendo avaliada por
-- ela em /gestor/bonificacao. Snapshots ficam — ver comentário acima.
delete from targets where metric_key = 'no_show_rate' and role = 'recepcao';

-- bonus_rule_sets (config de PLR por cargo, 20260908060000_bonus_rule_sets.sql):
-- se o gestor já cadastrou uma vigência com no_show_rate para a recepção,
-- o item some junto. Os pesos dos itens restantes NÃO são renormalizados de
-- propósito — o total ponderado cai e o gestor precisa reabrir
-- /gestor/bonificacao/config e decidir onde colocar o peso liberado, em vez
-- de uma migration redistribuir dinheiro de gente por conta própria.
delete from bonus_rule_set_items i
using bonus_rule_sets rs
where rs.id = i.rule_set_id
  and rs.role = 'recepcao'
  and i.metric_key = 'no_show_rate';
