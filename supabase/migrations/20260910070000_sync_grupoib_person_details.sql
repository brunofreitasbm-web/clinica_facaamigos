-- Espelha unidade e data de nascimento do Grupo IB em `profiles`.
--
-- A edge function `sync-grupoib-professional` é quem cria o profile a partir de
-- employees/professionals, mas a versão publicada no projeto está atrás da cópia
-- versionada em supabase/functions/ (variantes diferentes de matching de
-- especialidade, e-mail de primeiro acesso e senha inicial). Redeployar a cópia
-- do repo só pra carregar dois campos novos mudaria muito mais coisa do que o
-- pedido — então o espelhamento de `unit_id`/`birth_date` fica no banco, que
-- funciona com qualquer versão da função publicada.
--
-- SECURITY DEFINER porque os dois lados da sincronia são escritos por
-- aplicações/roles diferentes (o app de gestão de pessoas e a edge function), e
-- nenhum deles precisa de permissão de leitura cruzada pra que o espelho
-- funcione.

create or replace function public.fill_profile_person_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  found_birthdate date;
  found_unit text;
begin
  if new.source_system is distinct from 'grupo_ib' or new.source_id is null then
    return new;
  end if;

  select e.birthdate, e.unit_id into found_birthdate, found_unit
  from public.employees e where e.id = new.source_id;

  if not found then
    select p.birthdate, p.unit_id into found_birthdate, found_unit
    from public.professionals p where p.id = new.source_id;
  end if;

  -- coalesce: valor já preenchido (inclusive ajuste manual do gestor) não é
  -- sobrescrito por um campo vazio na origem.
  new.birth_date := coalesce(new.birth_date, found_birthdate);
  new.unit_id := coalesce(new.unit_id, found_unit);
  return new;
end;
$$;

drop trigger if exists trg_profiles_fill_person_details on public.profiles;
create trigger trg_profiles_fill_person_details
before insert or update of source_id, source_system on public.profiles
for each row execute function public.fill_profile_person_details();

-- Direção contrária: o colaborador corrige a data de nascimento ou muda de
-- unidade no sistema de gestão de pessoas e o profile acompanha.
create or replace function public.push_person_details_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set birth_date = new.birthdate,
      unit_id = new.unit_id
  where p.source_system = 'grupo_ib'
    and p.source_id = new.id
    and (p.birth_date is distinct from new.birthdate or p.unit_id is distinct from new.unit_id);
  return new;
end;
$$;

drop trigger if exists trg_employees_push_person_details on public.employees;
create trigger trg_employees_push_person_details
after update of birthdate, unit_id on public.employees
for each row execute function public.push_person_details_to_profile();

drop trigger if exists trg_professionals_push_person_details on public.professionals;
create trigger trg_professionals_push_person_details
after update of birthdate, unit_id on public.professionals
for each row execute function public.push_person_details_to_profile();

-- Funções de trigger não são chamáveis por RPC, mas ficam listadas no linter de
-- segurança do Supabase enquanto anon/authenticated tiverem EXECUTE nelas.
revoke execute on function public.fill_profile_person_details() from public, anon, authenticated;
revoke execute on function public.push_person_details_to_profile() from public, anon, authenticated;
