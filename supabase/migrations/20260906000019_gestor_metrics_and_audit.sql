-- Migration: 20260906000019_gestor_metrics_and_audit.sql
-- Módulo Gestor (PRD v1.3 §10, §13): Views de Métricas, Trava RLS e Audit Logs

-- 1. VIEW: Receita por Hora de Sala (revenue_per_room_hour)
CREATE OR REPLACE VIEW v_revenue_per_room_hour AS
SELECT 
  a.clinic_id,
  DATE_TRUNC('month', a.starts_at) AS competence_month,
  COUNT(DISTINCT a.id) AS total_sessions,
  SUM(EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 3600.0) AS total_room_hours,
  COALESCE(SUM(bi.amount), 0) AS total_revenue,
  CASE 
    WHEN SUM(EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 3600.0) > 0 
    THEN COALESCE(SUM(bi.amount), 0) / SUM(EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 3600.0)
    ELSE 0 
  END AS revenue_per_hour
FROM appointments a
LEFT JOIN billing_items bi ON bi.appointment_id = a.id AND bi.status != 'cancelado'
WHERE a.status = 'realizada'
GROUP BY a.clinic_id, DATE_TRUNC('month', a.starts_at);

-- 2. VIEW: Margem de Contribuição (contribution_margin - Resolução de Lacuna §7.1)
CREATE OR REPLACE VIEW v_contribution_margin AS
SELECT 
  a.clinic_id,
  DATE_TRUNC('month', a.starts_at) AS competence_month,
  COALESCE(SUM(bi.amount), 0) AS gross_revenue,
  COALESCE(SUM(p.gross_amount), 0) AS total_therapist_payout,
  COALESCE(SUM(bi.amount), 0) - COALESCE(SUM(p.gross_amount), 0) AS contribution_margin,
  CASE 
    WHEN COALESCE(SUM(bi.amount), 0) > 0 
    THEN ((COALESCE(SUM(bi.amount), 0) - COALESCE(SUM(p.gross_amount), 0)) / SUM(bi.amount)) * 100.0
    ELSE 0 
  END AS margin_percentage
FROM appointments a
LEFT JOIN billing_items bi ON bi.appointment_id = a.id AND bi.status != 'cancelado'
LEFT JOIN payouts p ON p.appointment_id = a.id
WHERE a.status = 'realizada'
GROUP BY a.clinic_id, DATE_TRUNC('month', a.starts_at);

-- 3. VIEW: Concentração de Convênios (insurer_concentration)
CREATE OR REPLACE VIEW v_insurer_concentration AS
WITH insurer_totals AS (
  SELECT 
    p.clinic_id,
    pi.insurer_id,
    i.name AS insurer_name,
    COUNT(DISTINCT pi.patient_id) AS patient_count
  FROM patient_insurance pi
  JOIN patients p ON p.id = pi.patient_id
  JOIN insurers i ON i.id = pi.insurer_id
  WHERE p.status = 'ativo' AND pi.is_private = false
  GROUP BY p.clinic_id, pi.insurer_id, i.name
),
clinic_totals AS (
  SELECT clinic_id, SUM(patient_count) AS total_patients
  FROM insurer_totals
  GROUP BY clinic_id
)
SELECT 
  it.clinic_id,
  it.insurer_id,
  it.insurer_name,
  it.patient_count,
  ct.total_patients,
  CASE 
    WHEN ct.total_patients > 0 THEN ROUND((it.patient_count::numeric / ct.total_patients::numeric) * 100.0, 2)
    ELSE 0
  END AS concentration_pct
FROM insurer_totals it
JOIN clinic_totals ct ON ct.clinic_id = it.clinic_id;

-- 4. VIEW: LTV em Meses (ltv_months)
CREATE OR REPLACE VIEW v_ltv_months AS
SELECT 
  p.clinic_id,
  COUNT(p.id) AS total_discharged_patients,
  COALESCE(
    AVG(EXTRACT(YEAR FROM AGE(COALESCE(p.updated_at, CURRENT_TIMESTAMP), p.created_at)) * 12 + 
        EXTRACT(MONTH FROM AGE(COALESCE(p.updated_at, CURRENT_TIMESTAMP), p.created_at))), 
    0
  ) AS avg_ltv_months
FROM patients p
WHERE p.status IN ('inativo', 'alta')
GROUP BY p.clinic_id;

-- 5. VIEW: Payout Ratio (payout_ratio)
CREATE OR REPLACE VIEW v_payout_ratio AS
SELECT 
  p.clinic_id,
  DATE_TRUNC('month', p.created_at) AS competence_month,
  COALESCE(SUM(p.gross_amount), 0) AS total_payouts,
  COALESCE(SUM(bi.amount), 0) AS gross_revenue,
  CASE 
    WHEN COALESCE(SUM(bi.amount), 0) > 0 
    THEN (COALESCE(SUM(p.gross_amount), 0) / SUM(bi.amount)) * 100.0
    ELSE 0
  END AS payout_ratio_pct
FROM payouts p
LEFT JOIN billing_items bi ON bi.appointment_id = p.appointment_id
GROUP BY p.clinic_id, DATE_TRUNC('month', p.created_at);

-- 6. AUDIT LOG TRIGGER FUNCTION PARA REGRAS FINANCEIRAS E CONTRATOS
CREATE OR REPLACE FUNCTION fn_audit_financial_mutations()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    clinic_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    created_at
  ) VALUES (
    COALESCE(NEW.clinic_id, OLD.clinic_id, NULL),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar Triggers em tabelas financeiras caso não existam
DROP TRIGGER IF EXISTS trg_audit_insurer_price_tables ON insurer_price_tables;
CREATE TRIGGER trg_audit_insurer_price_tables
  AFTER INSERT OR UPDATE OR DELETE ON insurer_price_tables
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financial_mutations();

DROP TRIGGER IF EXISTS trg_audit_therapist_contracts ON therapist_contracts;
CREATE TRIGGER trg_audit_therapist_contracts
  AFTER INSERT OR UPDATE OR DELETE ON therapist_contracts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financial_mutations();

DROP TRIGGER IF EXISTS trg_audit_targets ON targets;
CREATE TRIGGER trg_audit_targets
  AFTER INSERT OR UPDATE OR DELETE ON targets
  FOR EACH ROW EXECUTE FUNCTION fn_audit_financial_mutations();

-- 7. REFORÇO DE RLS: Gestor não pode mutar evoluções clínicas (session_notes)
DROP POLICY IF EXISTS gestor_no_mutation_session_notes ON session_notes;
CREATE POLICY gestor_no_mutation_session_notes ON session_notes
  FOR ALL
  TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = therapist_id OR auth.uid() = supervisor_id
  );
