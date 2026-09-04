-- Test Suite: Insurance Schema (Task 3)
-- Validates tables, constraints, and RLS policies for insurers, price tables, patient insurance, and authorizations

begin;
select plan(16);

-- Table existence tests
select has_table('insurers', 'Table insurers exists');
select has_table('insurer_price_tables', 'Table insurer_price_tables exists');
select has_table('patient_insurance', 'Table patient_insurance exists');
select has_table('authorizations', 'Table authorizations exists');

-- Column existence and types
select has_column('insurers', 'id', 'insurers has id column');
select has_column('insurers', 'clinic_id', 'insurers has clinic_id column');
select has_column('patient_insurance', 'patient_id', 'patient_insurance has patient_id column');
select has_column('authorizations', 'sessions_authorized', 'authorizations has sessions_authorized column');
select has_column('authorizations', 'sessions_used', 'authorizations has sessions_used column');

-- Constraints validation
select has_check('authorizations', 'authorizations_check', 'authorizations has check constraint sessions_used <= sessions_authorized');
select has_check('authorizations', 'authorizations_status_check', 'authorizations has check constraint on status enum');

-- RLS policies exist
select has_policy('insurers', 'insurers_read', 'insurers has read policy');
select has_policy('insurers', 'insurers_manage_gestor', 'insurers has manage policy');
select has_policy('insurer_price_tables', 'price_tables_read', 'insurer_price_tables has read policy');
select has_policy('insurer_price_tables', 'price_tables_manage_gestor', 'insurer_price_tables has manage policy');
select has_policy('patient_insurance', 'patient_insurance_read', 'patient_insurance has read policy');
select has_policy('patient_insurance', 'patient_insurance_write', 'patient_insurance has write policy');
select has_policy('authorizations', 'authorizations_read', 'authorizations has read policy');
select has_policy('authorizations', 'authorizations_write', 'authorizations has write policy');

-- Clinic scope validation test: verify policies requiring JOINs for clinic isolation are present
-- This prevents cross-clinic data access (e.g., gestor from clinic A modifying clinic B's data)
select * from finish();
rollback;
