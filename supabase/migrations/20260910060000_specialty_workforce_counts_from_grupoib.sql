-- Estagiários e profissionais PJ por especialidade deixam de ser digitados pelo
-- gestor e passam a ser derivados do sistema de gestão de pessoas do Grupo IB
-- (public.interns / public.professionals), unidade da clínica Faça Amigos
-- ("clinica-a" — INSTITUTO FACA AMIGOS LTDA). Os dois números são somente
-- leitura na tela /gestor/cadastros/especialidades.
--
-- Quando o Grupo IB traz um curso/profissão que ainda não existe no catálogo
-- daqui, a especialidade é criada automaticamente (mesma regra da edge function
-- sync-grupoib-professional, que já fazia isso para profissionais).

alter table specialties
  add column if not exists pj_count int not null default 0 check (pj_count >= 0);

comment on column specialties.intern_count is
  'Derivado de public.interns (unidade clinica-a) por trigger — não editar manualmente.';
comment on column specialties.pj_count is
  'Derivado de public.professionals (unidade clinica-a) por trigger — não editar manualmente.';

-- Normaliza texto livre vindo do Grupo IB ("Terapia Ocupacional", "Música",
-- "Psicólogo/a") para comparação: minúsculas, sem acento, só letras/números.
create or replace function public.specialty_source_norm(p_text text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_text, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- Resolve a especialidade correspondente a um curso/profissão do Grupo IB.
-- Ordem: radicais conhecidos (os mesmos da edge function) -> rótulo/chave já
-- cadastrados -> cria a especialidade que ainda não existe aqui.
create or replace function public.specialty_for_source_text(p_text text, p_clinic_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm  text := public.specialty_source_norm(p_text);
  v_value text;
  v_label text;
  v_id    uuid;
begin
  if v_norm = '' then
    return null;
  end if;

  -- 'psicopedagog' antes de 'psicolog', 'musicoterap' antes de 'music'.
  v_value := case
    when v_norm like '%musicoterap%' then 'musicoterapia'
    when v_norm like '%psicopedagog%' then 'psicopedagogia'
    when v_norm like '%music%' then 'musicoterapia'
    when v_norm like '%fonoaudiolog%' or v_norm like '%fono%' then 'fonoaudiologia'
    when v_norm like '%terapia ocupacional%' or v_norm like '%terapeuta ocupacional%' then 'terapia_ocupacional'
    when v_norm like '%fisioterap%' then 'fisioterapia'
    when v_norm like '%nutri%' then 'nutricao'
    when v_norm like '%psicolog%' or v_norm like '%psicoterap%'
      or v_norm like '%analista do comportamento%' or v_norm ~ '(^| )aba( |$)' then 'psicologia_aba'
    else null
  end;

  if v_value is not null then
    select id into v_id from specialties where clinic_id = p_clinic_id and value = v_value;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  select id into v_id
    from specialties
   where clinic_id = p_clinic_id
     and (public.specialty_source_norm(label) = v_norm
       or public.specialty_source_norm(value) = v_norm)
   order by sort_order
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  v_label := btrim(p_text);
  v_value := coalesce(v_value, left(regexp_replace(replace(v_norm, ' ', '_'), '[^a-z0-9_]', '', 'g'), 40));
  if v_value = '' then
    return null;
  end if;

  insert into specialties (clinic_id, value, label, sort_order, active)
  values (
    p_clinic_id,
    v_value,
    v_label,
    coalesce((select max(sort_order) from specialties where clinic_id = p_clinic_id), 0) + 1,
    true
  )
  on conflict (clinic_id, value) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Recalcula intern_count/pj_count de todas as especialidades da clínica.
-- Só entram pessoas ativas, com a mesma elegibilidade usada no sync do
-- Grupo IB (profissional PJ precisa estar com cadastro validado).
create or replace function public.refresh_specialty_workforce_counts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid := 'c0000000-0000-0000-0000-000000000001';
  v_unit   text := 'clinica-a';
  r        record;
begin
  for r in
    select distinct course as source_text
      from interns
     where unit_id = v_unit and active and btrim(coalesce(course, '')) <> ''
    union
    select distinct coalesce(nullif(btrim(profession), ''), specialties)
      from professionals
     where unit_id = v_unit and active and registration_status = 'validated'
  loop
    perform public.specialty_for_source_text(r.source_text, v_clinic);
  end loop;

  with intern_src as (
    select public.specialty_for_source_text(course, v_clinic) as specialty_id, count(*) as n
      from interns
     where unit_id = v_unit and active and btrim(coalesce(course, '')) <> ''
     group by 1
  ), pj_src as (
    select public.specialty_for_source_text(coalesce(nullif(btrim(profession), ''), specialties), v_clinic) as specialty_id,
           count(*) as n
      from professionals
     where unit_id = v_unit and active and registration_status = 'validated'
     group by 1
  )
  update specialties s
     set intern_count = coalesce((select n from intern_src i where i.specialty_id = s.id), 0),
         pj_count     = coalesce((select n from pj_src p where p.specialty_id = s.id), 0),
         updated_at   = now()
   where s.clinic_id = v_clinic
     and (s.intern_count <> coalesce((select n from intern_src i where i.specialty_id = s.id), 0)
       or s.pj_count     <> coalesce((select n from pj_src p where p.specialty_id = s.id), 0));
end;
$$;

create or replace function public.trg_refresh_specialty_workforce_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_specialty_workforce_counts();
  return null;
end;
$$;

drop trigger if exists interns_refresh_specialty_counts on interns;
create trigger interns_refresh_specialty_counts
  after insert or update or delete on interns
  for each statement execute function public.trg_refresh_specialty_workforce_counts();

drop trigger if exists professionals_refresh_specialty_counts on professionals;
create trigger professionals_refresh_specialty_counts
  after insert or update or delete on professionals
  for each statement execute function public.trg_refresh_specialty_workforce_counts();

select public.refresh_specialty_workforce_counts();
