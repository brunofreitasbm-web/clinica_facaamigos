-- Performance: envolve auth.uid()/auth.jwt()/auth.role() em (select ...) nas políticas de RLS sinalizadas
-- (advisor auth_rls_initplan), para o Postgres avaliar uma vez por consulta e não por linha.
-- Semântica idêntica: validado antes por simulação com os 23 usuários em 21 tabelas, sem nenhuma diferença.
do $$
declare
  al record; q text; w text; stmt text;
begin
  execute $f$ create function pg_temp.rw(e text) returns text language sql immutable as $b$
    select replace(replace(replace(replace(replace(replace(replace(replace(replace(
      e,
      '( SELECT auth.uid() AS uid)','@@UID@@'),'( SELECT auth.jwt() AS jwt)','@@JWT@@'),'( SELECT auth.role() AS role)','@@ROLE@@'),
      'auth.uid()','(select auth.uid())'),'auth.jwt()','(select auth.jwt())'),'auth.role()','(select auth.role())'),
      '@@UID@@','( SELECT auth.uid() AS uid)'),'@@JWT@@','( SELECT auth.jwt() AS jwt)'),'@@ROLE@@','( SELECT auth.role() AS role)')
  $b$ $f$;

  for al in
    select c.relname as tbl, pl.polname as nome, pl.oid as poloid, pl.polrelid as relid
    from pg_policy pl join pg_class c on c.oid = pl.polrelid
    where c.relnamespace = 'public'::regnamespace
      and c.relname in ('units','interns','records','document_contents','vitrine_devices','vitrine_videos','vitrine_playlist_items','documents','nps_surveys','voice_emergency_broadcasts','family_feedback','reschedule_requests','holidays','registration_drafts','insurance_intake_batches','incident_reports','external_contacts','external_contact_logs','talent_disc_tokens','staff_disc_tokens','at_sessions')
      and (coalesce(pg_get_expr(pl.polqual, pl.polrelid),'') || ' ' || coalesce(pg_get_expr(pl.polwithcheck, pl.polrelid),'')) ~ 'auth\.(uid|jwt|role)\(\)'
  loop
    select pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) into q, w from pg_policy where oid = al.poloid;
    if q is not null then q := pg_temp.rw(q); end if;
    if w is not null then w := pg_temp.rw(w); end if;
    stmt := format('alter policy %I on public.%I', al.nome, al.tbl);
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if w is not null then stmt := stmt || format(' with check (%s)', w); end if;
    execute stmt;
  end loop;
end $$;
