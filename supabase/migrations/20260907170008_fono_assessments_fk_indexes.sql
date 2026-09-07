-- supabase/migrations/20260907170008_fono_assessments_fk_indexes.sql
-- Índices de cobertura para as FKs de fono_assessments sem índice (achado
-- unindexed_foreign_keys do advisor de performance, mesmo padrão de
-- 20260905123902_fk_covering_indexes.sql). idx_fono_assessments_patient já
-- cobre patient_id; faltam clinic_id (usado por toda leitura via RLS) e
-- assessed_by.
create index if not exists idx_fono_assessments_clinic_id on public.fono_assessments (clinic_id);
create index if not exists idx_fono_assessments_assessed_by on public.fono_assessments (assessed_by);
