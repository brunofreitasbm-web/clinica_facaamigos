-- supabase/migrations/20260913200000_plr_human_effort_metrics.sql
--
-- Novas métricas de PLR para recepção e supervisor, desenhadas depois que o
-- chatbot Twilio (lib/twilio-intake-bot.ts, lib/twilio-faq-bot.ts) passou a
-- automatizar boa parte do funil de entrada (1ª resposta, coleta de
-- laudo/guia, oferta de horário). As métricas antigas que mediam esse trecho
-- (first_response_min, interessado_to_eval_rate, eval_show_rate,
-- confirm_d1_rate) saíram da tela de PLR/Bonificação
-- (BONUS_EXCLUDED_METRIC_KEYS em app/gestor/bonificacao/config/actions.ts) —
-- os snapshots continuam sendo calculados acima, só não entram mais na
-- apuração de bônus. auth_first_pass e plan_reviewed_rate também saíram: a
-- primeira nunca teve pipeline (`computed: false`) e a segunda não tinha
-- recorte de período (contava o histórico inteiro da clínica).
--
-- Este arquivo cobre duas lacunas de dado que as novas métricas precisam:
--   1. authorizations não tem created_at — sem isso não dá pra saber quando
--      uma guia foi cadastrada (requested_at nunca é preenchido pelo
--      formulário de recepção, app/recepcao/pacientes/[id]/stage-actions.ts).
--   2. twilio_conversations não tem escalated_at — a escalação do FAQ bot
--      (lib/twilio-faq-bot.ts, escalateToHuman) só grava status='pending' e
--      escalation_reason, sem timestamp.
--
-- close_monthly_metric_snapshots é `create or replace` de corpo inteiro,
-- redefinido a cada migration que o toca (a mais recente:
-- 20260910071000_intake_complete_rate_metric.sql). Este arquivo copia esse
-- corpo LITERALMENTE e só ACRESCENTA os blocos novos — qualquer outra base
-- reverteria silenciosamente as métricas já existentes.

alter table authorizations add column created_at timestamptz not null default now();
alter table twilio_conversations add column escalated_at timestamptz;

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

  -- ── novos (§ efeito bot/PLR, este arquivo) ──────────────────────────
  guia_renew_denom bigint; guia_renew_num bigint;
  guia_completa_denom bigint; guia_completa_num bigint;
  lead_conv_denom bigint; lead_conv_num bigint;
  report_denom bigint; report_num bigint;
  avail_hours numeric; therapist_realized_hours numeric;
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

    -- ── plan_reviewed_rate: mantido calculado (§10) mesmo fora do PLR ──
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

    -- ── guia_renewed_on_time_rate (recepção) ───────────────────────────
    -- Guias que venceram no mês (de paciente ainda não inativo): a recepção
    -- "renovou a tempo" quando já existe uma guia sucessora
    -- (previous_authorization_id aponta pra esta) cadastrada até a data de
    -- vencimento da guia antiga. Sem isso a sessão do mês seguinte cai na
    -- eliminatória no_auth_sessions — esta métrica antecipa o problema.
    select count(*),
      count(*) filter (where exists (
        select 1 from authorizations succ
        where succ.previous_authorization_id = a.id and succ.created_at <= a.valid_to
      ))
    into guia_renew_denom, guia_renew_num
    from authorizations a
    join patient_insurance pi on pi.id = a.patient_insurance_id
    join patients p on p.id = pi.patient_id
    where p.clinic_id = clinic_row.id
      and p.status <> 'inativo'
      and a.valid_to >= v_period_start and a.valid_to < v_period_end;

    perform upsert_metric_snapshot('guia_renewed_on_time_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when guia_renew_denom > 0 then guia_renew_num::numeric / guia_renew_denom else null end);

    -- ── guia_completa_rate (recepção) ──────────────────────────────────
    -- Guias cadastradas no mês com todos os campos que a recepção
    -- normalmente só descobre no atendimento (senha de autorização e sua
    -- vigência, CID do paciente) preenchidos — não só os campos obrigatórios
    -- do formulário (procedure_code/sessions_authorized/vigência).
    select count(*),
      count(*) filter (
        where a.guide_number is not null
          and a.authorization_password is not null
          and a.password_valid_until is not null
          and p.cid is not null
      )
    into guia_completa_denom, guia_completa_num
    from authorizations a
    join patient_insurance pi on pi.id = a.patient_insurance_id
    join patients p on p.id = pi.patient_id
    where p.clinic_id = clinic_row.id
      and a.created_at >= v_period_start and a.created_at < v_period_end;

    perform upsert_metric_snapshot('guia_completa_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when guia_completa_denom > 0 then guia_completa_num::numeric / guia_completa_denom else null end);

    -- ── draft_validation_min (recepção) ─────────────────────────────────
    -- A IA extrai o pré-cadastro vindo do WhatsApp (registration_drafts,
    -- lib/registration-drafts-ingest.ts); a recepção só precisa validar ou
    -- rejeitar (app/recepcao/pre-cadastros/actions.ts). Este é o "tempo de
    -- resposta" que sobrou pra pessoa depois do bot.
    perform upsert_metric_snapshot('draft_validation_min', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (coalesce(rd.validated_at, rd.rejected_at) - rd.processed_at)) / 60.0)::numeric
       from registration_drafts rd
       where rd.clinic_id = clinic_row.id
         and rd.processed_at is not null
         and coalesce(rd.validated_at, rd.rejected_at) >= v_period_start
         and coalesce(rd.validated_at, rd.rejected_at) < v_period_end));

    -- ── escalation_response_min (recepção) ──────────────────────────────
    -- O FAQ bot (lib/twilio-faq-bot.ts) escalona pra humano quando o assunto
    -- é clínico, desconhecido, ou a família pede — mede quanto tempo a
    -- recepção leva pra assumir a conversa depois disso.
    perform upsert_metric_snapshot('escalation_response_min', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (order by extract(epoch from (fm.first_agent_at - c.escalated_at)) / 60.0)::numeric
       from twilio_conversations c
       join patients p on p.id = c.patient_id
       cross join lateral (
         select min(m.sent_at) as first_agent_at
         from messages m
         where m.conversation_id = c.id and m.sender_type = 'agent' and m.sent_at > c.escalated_at
       ) fm
       where p.clinic_id = clinic_row.id
         and c.escalated_at >= v_period_start and c.escalated_at < v_period_end
         and fm.first_agent_at is not null));

    -- ── therapist_utilization_rate (supervisor) ─────────────────────────
    -- Horas realizadas ÷ horas de disponibilidade cadastrada
    -- (professional_availability) dos terapeutas ativos no mês — diferente
    -- de occupancy_rate (que só olha o que já foi agendado), esta enxerga a
    -- disponibilidade que nem chegou a virar agenda: é a alavanca de
    -- faturamento que o supervisor controla via grade/disponibilidade.
    select coalesce(sum(extract(epoch from (pa.end_time - pa.start_time)) / 3600.0), 0)
    into avail_hours
    from generate_series(v_period_start, v_period_end - interval '1 day', interval '1 day') gs(day)
    join profiles pr on pr.clinic_id = clinic_row.id and pr.role = 'terapeuta' and pr.active
    join professional_availability pa on pa.profile_id = pr.id and pa.active
      and pa.day_of_week = extract(dow from gs.day);

    select coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 3600.0), 0)
    into therapist_realized_hours
    from appointments a
    join profiles pr on pr.id = a.therapist_id
    where pr.clinic_id = clinic_row.id and pr.role = 'terapeuta'
      and a.status = 'realizada'
      and a.starts_at >= v_period_start and a.starts_at < v_period_end;

    perform upsert_metric_snapshot('therapist_utilization_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when avail_hours > 0 then therapist_realized_hours / avail_hours else null end);

    -- ── intake_lead_approval_min (supervisor) ───────────────────────────
    -- O bot coleta laudo/guia (lib/twilio-intake-bot.ts); o supervisor
    -- aprova o lead depois de validar os documentos
    -- (app/supervisao/acolhimento-actions.ts). Mede esse gargalo humano.
    perform upsert_metric_snapshot('intake_lead_approval_min', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (l.approved_at - coalesce(l.last_file_at, l.contact_sent_at))) / 60.0)::numeric
       from insurance_intake_leads l
       where l.clinic_id = clinic_row.id
         and l.approved_at >= v_period_start and l.approved_at < v_period_end
         and coalesce(l.last_file_at, l.contact_sent_at) is not null));

    -- ── intake_lead_conversion_10d_rate (supervisor) ────────────────────
    -- Lead de convênio aprovado no mês → paciente com 1ª sessão em até 10
    -- dias. Aprovar rápido não adianta se a agenda emperra depois.
    select count(*),
      count(*) filter (where p.first_session_at is not null and p.first_session_at <= l.approved_at + interval '10 days')
    into lead_conv_denom, lead_conv_num
    from insurance_intake_leads l
    join patients p on p.id = l.patient_id
    where l.clinic_id = clinic_row.id
      and l.approved_at >= v_period_start and l.approved_at < v_period_end
      and l.patient_id is not null;

    perform upsert_metric_snapshot('intake_lead_conversion_10d_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when lead_conv_denom > 0 then lead_conv_num::numeric / lead_conv_denom else null end);

    -- ── waitlist_fill_days (supervisor) ─────────────────────────────────
    -- Dias entre entrar na lista de espera (waitlist_entries) e ser
    -- agendado — waitlist_entries não guarda o timestamp exato da
    -- transição pra 'agendado', updated_at é a melhor aproximação
    -- disponível hoje (a tabela não tem um trigger de histórico de status).
    perform upsert_metric_snapshot('waitlist_fill_days', 'clinica', clinic_row.id, v_period_start, v_period_end,
      (select percentile_cont(0.5) within group (
         order by extract(epoch from (we.updated_at - we.created_at)) / 86400.0)::numeric
       from waitlist_entries we
       where we.clinic_id = clinic_row.id
         and we.status = 'agendado'
         and we.updated_at >= v_period_start and we.updated_at < v_period_end));

    -- ── report_approved_5d_rate (supervisor) ────────────────────────────
    -- Relatórios de convênio (draft_reports) aprovados em até 5 dias do
    -- pedido — atrasa a renovação de guia e a família só vê valor quando o
    -- relatório sai.
    select count(*), count(*) filter (where dr.approved_at is not null and dr.approved_at <= dr.created_at + interval '5 days')
    into report_denom, report_num
    from draft_reports dr
    join patients p on p.id = dr.patient_id
    where p.clinic_id = clinic_row.id
      and dr.created_at >= v_period_start and dr.created_at < v_period_end;

    perform upsert_metric_snapshot('report_approved_5d_rate', 'clinica', clinic_row.id, v_period_start, v_period_end,
      case when report_denom > 0 then report_num::numeric / report_denom else null end);

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
