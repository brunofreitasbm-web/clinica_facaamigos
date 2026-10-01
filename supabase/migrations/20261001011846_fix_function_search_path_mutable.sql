-- Fixa o search_path nas funções de negócio sinalizadas pelo advisor (function_search_path_mutable).
-- Ignora timerange/timemultirange: construtores gerados pelo tipo de intervalo, não são código do app.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.proconfig is null
      and p.proname in (
        'aba_training_classes_room_guard','appointments_availability_guard','appointments_checkin_guard',
        'appointments_group_overlap_guard','freelance_jobs_set_updated_at','generate_from_recurrence_anchor',
        'generate_recurrence_sessions','is_valid_professional_pin','patient_absence_stats',
        'pts_review_due_at','specialty_source_norm','trg_treatment_plans_default_review_due_at')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;
