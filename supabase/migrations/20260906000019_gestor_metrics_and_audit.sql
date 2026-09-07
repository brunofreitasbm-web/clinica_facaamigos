-- Migration: 20260906000019_gestor_metrics_and_audit.sql
-- Módulo Gestor (PRD v1.3 §10, §13): Views de Métricas, Trava RLS e Audit Logs
--
-- Corrigido: a primeira versão desta migration nunca chegou a ser aplicada
-- em nenhum ambiente (ficou só no repositório) porque referenciava colunas
-- que não existem no schema real — appointments.clinic_id, payouts.clinic_id,
-- patients.updated_at, session_notes.clinic_id/supervisor_id — e teria
-- falhado na criação das views ou quebrado em runtime nos triggers de
-- auditoria. Reescrita pra usar os relacionamentos reais (clinic_id sempre
-- via patients/profiles) e o trigger de auditoria genérico já existente
-- (fn_audit_log, 20260904000012_audit_and_messages.sql) em vez de
-- reimplementar um novo. A policy de "reforço" em session_notes foi
-- removida: a tabela já não tem nenhuma policy de update/delete (é
-- append-only por design), então não há mutação de gestor pra bloquear.

-- 1. VIEW: Receita por Hora de Sala (revenue_per_room_hour)
CREATE OR REPLACE VIEW v_revenue_per_room_hour AS
SELECT
  p.clinic_id,
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
JOIN patients p ON p.id = a.patient_id
LEFT JOIN billing_items bi ON bi.appointment_id = a.id AND bi.status != 'cancelado'
WHERE a.status = 'realizada'
GROUP BY p.clinic_id, DATE_TRUNC('month', a.starts_at);

-- 2. VIEW: Margem de Contribuição (contribution_margin - Resolução de Lacuna §7.1)
CREATE OR REPLACE VIEW v_contribution_margin AS
SELECT
  p.clinic_id,
  DATE_TRUNC('month', a.starts_at) AS competence_month,
  COALESCE(SUM(bi.amount), 0) AS gross_revenue,
  COALESCE(SUM(po.gross_amount), 0) AS total_therapist_payout,
  COALESCE(SUM(bi.amount), 0) - COALESCE(SUM(po.gross_amount), 0) AS contribution_margin,
  CASE
    WHEN COALESCE(SUM(bi.amount), 0) > 0
    THEN ((COALESCE(SUM(bi.amount), 0) - COALESCE(SUM(po.gross_amount), 0)) / SUM(bi.amount)) * 100.0
    ELSE 0
  END AS margin_percentage
FROM appointments a
JOIN patients p ON p.id = a.patient_id
LEFT JOIN billing_items bi ON bi.appointment_id = a.id AND bi.status != 'cancelado'
LEFT JOIN payouts po ON po.therapist_id = a.therapist_id AND po.competence_month = DATE_TRUNC('month', a.starts_at)::date
WHERE a.status = 'realizada'
GROUP BY p.clinic_id, DATE_TRUNC('month', a.starts_at);

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

-- 4. VIEW: LTV em Meses (ltv_months) — patients não tem updated_at; usa
-- first_session_at (início do tratamento ativo) até agora como proxy de
-- tempo de permanência. 'inativo' não é um status válido
-- (patients_status_check) — o mais próximo do conceito é 'alta' e 'evadido'.
CREATE OR REPLACE VIEW v_ltv_months AS
SELECT
  p.clinic_id,
  COUNT(p.id) AS total_discharged_patients,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(p.first_session_at, p.created_at))) / 2629800.0),
    0
  ) AS avg_ltv_months
FROM patients p
WHERE p.status IN ('alta', 'evadido')
GROUP BY p.clinic_id;

-- 5. VIEW: Payout Ratio (payout_ratio)
CREATE OR REPLACE VIEW v_payout_ratio AS
SELECT
  pr.clinic_id,
  DATE_TRUNC('month', po.competence_month) AS competence_month,
  COALESCE(SUM(po.gross_amount), 0) AS total_payouts,
  COALESCE(SUM(bi.amount), 0) AS gross_revenue,
  CASE
    WHEN COALESCE(SUM(bi.amount), 0) > 0
    THEN (COALESCE(SUM(po.gross_amount), 0) / SUM(bi.amount)) * 100.0
    ELSE 0
  END AS payout_ratio_pct
FROM payouts po
JOIN profiles pr ON pr.id = po.therapist_id
LEFT JOIN appointments a ON a.therapist_id = po.therapist_id
  AND DATE_TRUNC('month', a.starts_at)::date = po.competence_month
LEFT JOIN billing_items bi ON bi.appointment_id = a.id
GROUP BY pr.clinic_id, DATE_TRUNC('month', po.competence_month);

-- 6. Auditoria de mutações em tabelas financeiras/contratuais — reaproveita
-- o trigger genérico já existente (fn_audit_log, 20260904000012) em vez de
-- uma função nova que assumia clinic_id em tabelas que não têm essa coluna.
DROP TRIGGER IF EXISTS trg_audit_insurer_price_tables ON insurer_price_tables;
CREATE TRIGGER trg_audit_insurer_price_tables
  AFTER INSERT OR UPDATE OR DELETE ON insurer_price_tables
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_therapist_contracts ON therapist_contracts;
CREATE TRIGGER trg_audit_therapist_contracts
  AFTER INSERT OR UPDATE OR DELETE ON therapist_contracts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_targets ON targets;
CREATE TRIGGER trg_audit_targets
  AFTER INSERT OR UPDATE OR DELETE ON targets
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
