-- supabase/migrations/20260908090001_profiles_self_update_recursion_fix.sql
-- Bug: qualquer UPDATE em profiles feito pelo próprio usuário (ex.: salvar o
-- PIN de assinatura em app/terapeuta/evolucao/actions.ts::setSignaturePin)
-- falhava com "infinite recursion detected in policy for relation profiles"
-- (42P17). A policy profiles_self_update (criada em 20260904000014, com
-- WITH CHECK reescrito em 20260905123900) usa subqueries inline
-- "(select p.col from profiles p where p.id = auth.uid())" para travar
-- role/clinic_id/esdm_certified/active. Em contexto de UPDATE sobre a
-- própria tabela, essas subqueries reabrem a checagem de RLS de profiles
-- e recursam — confirmado via teste funcional em transação com rollback
-- (qualquer UPDATE, não só o de PIN, falhava).
-- Fix: substituir as subqueries inline por funções SECURITY DEFINER (mesmo
-- padrão de current_clinic_id()/app_current_role(), já usadas sem problema
-- nessa mesma policy) — funções SECURITY DEFINER de propriedade do owner da
-- tabela (postgres) não reaplicam RLS, então não recursam.
create or replace function current_esdm_certified() returns boolean
language sql stable security definer set search_path = public as $$
  select esdm_certified from profiles where id = auth.uid();
$$;

create or replace function current_profile_active() returns boolean
language sql stable security definer set search_path = public as $$
  select active from profiles where id = auth.uid();
$$;

alter policy "profiles_self_update" on public."profiles"
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select app_current_role())
    and clinic_id = (select current_clinic_id())
    and esdm_certified = (select current_esdm_certified())
    and active = (select current_profile_active())
  );
