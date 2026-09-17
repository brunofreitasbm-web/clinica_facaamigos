-- supabase/migrations/20260917170700_checkin_paper_signatures.sql
-- Check-in em papel: o responsavel assina a ficha de presenca e a guia
-- fisicamente na recepcao (decisao do usuario: sem captura digital nesta
-- fase). O sistema so registra que a assinatura ocorreu (checkbox) e quem
-- confirmou, para poder emitir a ficha mensal de presenca depois.
alter table appointments
  add column if not exists presence_sheet_signed_at timestamptz,
  add column if not exists guide_signed_at timestamptz,
  add column if not exists signatures_recorded_by uuid references profiles(id);

-- Ficha mensal de presenca por paciente (lib/presence-sheet-pdf.tsx,
-- app/recepcao/pacientes/[id]/ficha-presenca). p_month e qualquer data
-- dentro do mes desejado; o range e calculado em CLINIC_TIMEZONE pelo
-- caller (lib/timezone.ts) e passado como bounds explicitos para a função
-- ficar pura em relação a fuso horário.
create function monthly_presence_sheet(p_patient_id uuid, p_month_start timestamptz, p_month_end timestamptz)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  therapist_name text,
  discipline text,
  status text,
  presence_sheet_signed_at timestamptz,
  guide_signed_at timestamptz,
  guide_number text
)
language sql stable as $$
  select
    a.id,
    a.starts_at,
    pr.full_name,
    a.discipline,
    a.status,
    a.presence_sheet_signed_at,
    a.guide_signed_at,
    au.guide_number
  from appointments a
  join profiles pr on pr.id = a.therapist_id
  left join authorizations au on au.id = a.authorization_id
  where a.patient_id = p_patient_id
    and a.starts_at >= p_month_start
    and a.starts_at < p_month_end
  order by a.starts_at;
$$;

grant execute on function monthly_presence_sheet(uuid, timestamptz, timestamptz) to authenticated;
