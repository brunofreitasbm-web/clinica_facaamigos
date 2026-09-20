-- Psicoterapia tem 30 min (particular e plano); as demais terapias seguem 40 min.
-- A duração vale também para a agenda: createAppointment calcula o fim da
-- sessão por appointment_types.duration_minutes.

update public.insurer_price_tables p
set duration_minutes = 30,
    session_frequency_note = 'Exceção: modalidade convencional tem valor reduzido (R$ 150); demais especialidades R$ 200. Exceção de duração: psicoterapia tem 30 min (demais terapias 40 min).'
from public.insurers i
where i.id = p.insurer_id
  and i.name = 'Particular'
  and p.procedure_code = 'PART-PSICOTER';

update public.specialty_prices
set duration_minutes = 30, updated_at = now()
where specialty_value = 'psicoterapia';

update public.appointment_types
set duration_minutes = 30, display_interval_minutes = 30, updated_at = now()
where name in ('Psicoterapia', 'Psicoterapia Convencional');
