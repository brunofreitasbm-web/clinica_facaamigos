-- Reverte o mapeamento adivinhado em 20260909280000 (que marcou
-- "Neuropsicologia", "Psicoterapia" e "Fonoaudiologia" como isentas da
-- regra 1:1): essas continuam com apoio de estagiário. As especialidades
-- sem estagiário citadas pelo usuário — avaliação neuropsicológica,
-- psicoterapia convencional e fonoaudiologia convencional — são tipos de
-- atendimento próprios, cadastrados aqui já com requires_intern_ratio = false.
update appointment_types
set requires_intern_ratio = true
where name in ('Neuropsicologia', 'Psicoterapia', 'Fonoaudiologia');

insert into appointment_types (clinic_id, name, modality, duration_minutes, display_interval_minutes, recurrence, requires_intern_ratio)
select c.id, v.name, 'presencial', v.duration_minutes, v.display_interval_minutes, v.recurrence, false
from clinics c
cross join (values
  ('Avaliação Neuropsicológica', 40, 10, 'unica'),
  ('Psicoterapia Convencional', 30, 30, 'semanal'),
  ('Fonoaudiologia Convencional', 30, 30, 'semanal')
) as v(name, duration_minutes, display_interval_minutes, recurrence)
on conflict (clinic_id, name) do nothing;
