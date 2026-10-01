-- Reduz a superfície de /rest/v1/rpc para o papel anon (advisor anon_security_definer_function_executable).
-- Mantidas com acesso anon: funções públicas reais (tela pública, cadastros por token, DISC, vitrine)
-- e helpers usados dentro de políticas de RLS (app_current_role, current_clinic_id, has_patient_access etc.).

do $$
declare r record;
begin
  -- 1) Funções de gatilho: não precisam de EXECUTE para o gatilho disparar, e nunca devem ser RPC.
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.prorettype = 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;

  -- 2) Funções que só fazem sentido para usuário logado ou serviço (uso confirmado em código e logs).
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname in (
        'aba_training_balance','aba_training_consume_pool','accept_family_lgpd_consent',
        'count_overdue_session_notes','list_overdue_session_notes','family_guidance_feed',
        'import_candidate_disc_to_staff','patient_status_as_of','refresh_specialty_workforce_counts',
        'session_note_pending','session_notes_pending_status','set_family_image_consent',
        'set_patient_photo','specialty_for_source_text','auto_resume_pending_bots')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

-- Reversão de uma função específica, se necessário:
-- grant execute on function public.<nome>(<args>) to anon;
