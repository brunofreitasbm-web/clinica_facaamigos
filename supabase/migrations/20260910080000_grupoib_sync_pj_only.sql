-- Só profissionais PJ (public.professionals) viram conta no sistema da clínica,
-- e sempre com o papel "terapeuta". Funcionário CLT (public.employees) não entra
-- automaticamente: quem precisa de acesso é cadastrado à mão em /gestor/equipe,
-- com o papel escolhido por um humano.
--
-- A edge function já recusa payload de employees, mas manter a trigger viva só
-- geraria uma chamada HTTP inútil por edição de funcionário — e deixaria a regra
-- parecendo dois lugares diferentes.

drop trigger if exists trg_employees_sync_clinica on public.employees;
drop trigger if exists trg_employees_push_person_details on public.employees;

-- Sem employees na origem, o espelho de unidade/nascimento (ver
-- 20260910070000_sync_grupoib_person_details.sql) só precisa olhar professionals.
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

  select p.birthdate, p.unit_id into found_birthdate, found_unit
  from public.professionals p where p.id = new.source_id;

  -- coalesce: valor já preenchido (inclusive ajuste manual do gestor) não é
  -- sobrescrito por um campo vazio na origem.
  new.birth_date := coalesce(new.birth_date, found_birthdate);
  new.unit_id := coalesce(new.unit_id, found_unit);
  return new;
end;
$$;

revoke execute on function public.fill_profile_person_details() from public, anon, authenticated;
