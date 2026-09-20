-- supabase/migrations/20260918_metabase_bi_views.sql
-- Views preparadas para o METABASE respeitando a regra de comparativo obrigatório (AGENTS.md)

-- 1. View: KPIs de Faturamento Mensal com Comparativo MoM e Meta
CREATE OR REPLACE VIEW metabase_monthly_faturamento_kpis WITH (security_invoker = true) AS
WITH monthly_billing AS (
    SELECT 
        clinic_id,
        date_trunc('month', created_at) AS month_date,
        SUM(total_amount) AS faturamento_atual
    FROM billing_batches
    GROUP BY clinic_id, date_trunc('month', created_at)
)
SELECT 
    mb.clinic_id,
    to_char(mb.month_date, 'YYYY-MM') AS competencia,
    mb.faturamento_atual,
    COALESCE(LAG(mb.faturamento_atual) OVER (PARTITION BY mb.clinic_id ORDER BY mb.month_date), 0) AS faturamento_mes_anterior,
    ROUND(
        CASE 
            WHEN LAG(mb.faturamento_atual) OVER (PARTITION BY mb.clinic_id ORDER BY mb.month_date) > 0 
            THEN ((mb.faturamento_atual - LAG(mb.faturamento_atual) OVER (PARTITION BY mb.clinic_id ORDER BY mb.month_date)) 
                  / LAG(mb.faturamento_atual) OVER (PARTITION BY mb.clinic_id ORDER BY mb.month_date)) * 100
            ELSE 0 
        END, 2
    ) AS variacao_mom_pct,
    -- Meta/Target configurada ou padronizada
    150000.00 AS faturamento_meta,
    ROUND((mb.faturamento_atual / 150000.00) * 100, 2) AS atingimento_meta_pct
FROM monthly_billing mb;

-- 2. View: Pontualidade de Evolução por Terapeuta com Comparativo MoM
CREATE OR REPLACE VIEW metabase_therapist_evolution_kpis WITH (security_invoker = true) AS
WITH monthly_evoluctions AS (
    SELECT 
        clinic_id,
        therapist_id,
        date_trunc('month', created_at) AS month_date,
        COUNT(id) AS total_evolucoes,
        COUNT(CASE WHEN signed_at IS NOT NULL THEN 1 END) AS evolucoes_assinadas
    FROM session_notes
    GROUP BY clinic_id, therapist_id, date_trunc('month', created_at)
)
SELECT 
    me.clinic_id,
    me.therapist_id,
    to_char(me.month_date, 'YYYY-MM') AS mes,
    me.total_evolucoes,
    me.evolucoes_assinadas,
    ROUND((me.evolucoes_assinadas::numeric / NULLIF(me.total_evolucoes, 0)) * 100, 2) AS taxa_pontualidade_atual_pct,
    ROUND(
        LAG((me.evolucoes_assinadas::numeric / NULLIF(me.total_evolucoes, 0)) * 100) 
        OVER (PARTITION BY me.clinic_id, me.therapist_id ORDER BY me.month_date), 2
    ) AS taxa_pontualidade_mes_anterior_pct,
    95.00 AS meta_pontualidade_pct
FROM monthly_evoluctions me;

-- 3. View: Taxa de Faltas/Cancelamentos com Comparativo MoM e Meta (< 10%)
CREATE OR REPLACE VIEW metabase_absence_rate_kpis WITH (security_invoker = true) AS
WITH monthly_appts AS (
    SELECT 
        clinic_id,
        date_trunc('month', starts_at) AS month_date,
        COUNT(id) AS total_agendamentos,
        COUNT(CASE WHEN status IN ('falta', 'cancelada') THEN 1 END) AS total_faltas
    FROM appointments
    GROUP BY clinic_id, date_trunc('month', starts_at)
)
SELECT 
    ma.clinic_id,
    to_char(ma.month_date, 'YYYY-MM') AS mes,
    ma.total_agendamentos,
    ma.total_faltas,
    ROUND((ma.total_faltas::numeric / NULLIF(ma.total_agendamentos, 0)) * 100, 2) AS taxa_faltas_atual_pct,
    ROUND(
        LAG((ma.total_faltas::numeric / NULLIF(ma.total_agendamentos, 0)) * 100) 
        OVER (PARTITION BY ma.clinic_id ORDER BY ma.month_date), 2
    ) AS taxa_faltas_mes_anterior_pct,
    10.00 AS meta_max_faltas_pct
FROM monthly_appts ma;
