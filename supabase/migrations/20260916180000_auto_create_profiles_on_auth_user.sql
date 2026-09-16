-- 20260916180000_auto_create_profiles_on_auth_user.sql
-- Garante que todo usuário cadastrado no Auth receba um registro correspondente
-- em `public.profiles`, resolvendo a ausência de colaboradores na tela do gestor.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid := 'c0000000-0000-0000-0000-000000000001'::uuid;
  v_role text;
  v_full_name text;
  v_unit_id text;
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    v_role := coalesce(
      new.raw_user_meta_data->>'role',
      new.raw_app_meta_data->>'role',
      case
        when new.email like '%gestor%' then 'gestor'
        when new.email like '%supervisor%' then 'supervisor'
        when new.email like '%recepcao%' then 'recepcao'
        when new.email like '%faturamento%' then 'faturamento'
        else 'terapeuta'
      end
    );

    if v_role not in ('gestor', 'supervisor', 'terapeuta', 'recepcao', 'faturamento', 'responsavel') then
      v_role := 'terapeuta';
    end if;

    v_full_name := coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      initcap(split_part(coalesce(new.email, 'Colaborador'), '@', 1))
    );

    v_unit_id := coalesce(
      new.raw_user_meta_data->>'unit_id',
      new.raw_app_meta_data->>'unit_id'
    );

    insert into public.profiles (
      id,
      clinic_id,
      role,
      full_name,
      email,
      active,
      unit_id
    ) values (
      new.id,
      v_clinic_id,
      v_role,
      v_full_name,
      new.email,
      true,
      v_unit_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill para quaisquer usuários auth pré-existentes sem perfil
insert into public.profiles (id, clinic_id, role, full_name, email, active, unit_id)
select
  u.id,
  'c0000000-0000-0000-0000-000000000001'::uuid,
  case
    when coalesce(u.raw_user_meta_data->>'role', u.raw_app_meta_data->>'role') in ('gestor', 'supervisor', 'terapeuta', 'recepcao', 'faturamento', 'responsavel')
      then coalesce(u.raw_user_meta_data->>'role', u.raw_app_meta_data->>'role')
    when u.email like '%gestor%' then 'gestor'
    when u.email like '%supervisor%' then 'supervisor'
    when u.email like '%recepcao%' then 'recepcao'
    when u.email like '%faturamento%' then 'faturamento'
    else 'terapeuta'
  end,
  coalesce(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    initcap(split_part(coalesce(u.email, 'Colaborador'), '@', 1))
  ),
  u.email,
  true,
  coalesce(u.raw_user_meta_data->>'unit_id', u.raw_app_meta_data->>'unit_id')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
