-- supabase/migrations/20260908190000_terapeuta_record_access_trail.sql
-- Auditoria do prontuário no portal do terapeuta (/terapeuta/prontuario).
--
-- record_access_log_read é gestor/supervisor apenas (20260904000012, mantida
-- em 20260905123900). Um terapeuta lê zero linhas via SELECT direto — o que
-- é pior que não mostrar nada, porque "0 acessos" é uma afirmação LGPD
-- falsa, não a ausência da informação.
--
-- Mesmo raciocínio de patient_contact_summary (20260907170000): RLS é por
-- LINHA, não por coluna, então uma policy de SELECT também entregaria ao
-- terapeuta os UUIDs accessed_by de todo gestor/recepção que já abriu o
-- prontuário. Uma função security definer devolve só o que a tela precisa
-- (nome, papel, motivo, data) e só para pacientes com os quais o terapeuta
-- já tem vínculo.
create function patient_record_access_trail(p_patient_id uuid, p_days int default 30)
returns table (
  accessed_at timestamptz,
  accessor_name text,
  accessor_role text,
  reason text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from patients p
    where p.id = p_patient_id and p.clinic_id = current_clinic_id()
  ) then
    raise exception 'access denied';
  end if;

  if not (
    app_current_role() in ('gestor','supervisor')
    or has_patient_access(p_patient_id, array['terapeuta'])
  ) then
    raise exception 'access denied';
  end if;

  return query
    select l.accessed_at, pr.full_name, pr.role, l.reason
    from record_access_log l
    join profiles pr on pr.id = l.accessed_by
    where l.patient_id = p_patient_id
      and l.accessed_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
    order by l.accessed_at desc
    limit 200;
end;
$$;

revoke all on function patient_record_access_trail(uuid, int) from public, anon;
grant execute on function patient_record_access_trail(uuid, int) to authenticated;
-- Ver 20260907170005: "revoke ... from public" não tira o acesso de `anon`
-- neste projeto por causa de ALTER DEFAULT PRIVILEGES — revoke explícito.
revoke execute on function patient_record_access_trail(uuid, int) from anon;
