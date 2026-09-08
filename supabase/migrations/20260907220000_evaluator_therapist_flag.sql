-- supabase/migrations/20260907220000_evaluator_therapist_flag.sql
-- Terapeutas habilitados a conduzir 1ª avaliação/anamnese — flag de
-- qualificação do profissional (mesmo padrão de `is_rt`,
-- 20260906000002_evaluation_team.sql), não um papel de acesso (não mexe no
-- CHECK de profiles.role). Usado para filtrar quem aparece no seletor de
-- terapeuta do calendário de 1ª avaliação
-- (app/supervisao/evaluation-calendar.tsx) — nem todo terapeuta faz
-- avaliação, só quem tem essa qualificação marcada pelo gestor.
alter table profiles add column if not exists is_evaluator boolean not null default false;
