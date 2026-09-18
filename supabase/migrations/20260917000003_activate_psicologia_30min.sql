-- supabase/migrations/20260917000003_activate_psicologia_30min.sql
-- Ativa o tipo de atendimento 'Psicologia (30min)' de 30 minutos na clínica.

insert into appointment_types (clinic_id, name, modality, duration_minutes, display_interval_minutes, recurrence, requires_intern_ratio, active)
select c.id, 'Psicologia (30min)', 'presencial', 30, 30, 'semanal', true, true
from clinics c
on conflict (clinic_id, name) do update
set active = true,
    duration_minutes = 30,
    display_interval_minutes = 30,
    updated_at = now();
