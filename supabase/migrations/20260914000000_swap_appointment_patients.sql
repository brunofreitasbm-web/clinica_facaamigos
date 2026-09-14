-- supabase/migrations/20260914000000_swap_appointment_patients.sql
--
-- Botão "Editar" da Agenda (app/supervisao/grade-panel.tsx): permuta manual
-- de 2 ou 3 pacientes entre agendamentos já existentes — caso de exceção
-- citado pelo usuário (ex.: reorganização de horários na revisão de PTS de
-- 6 meses, quando duas ou três crianças trocam de horário entre si).
--
-- Só troca o que é do PACIENTE (patient_id, authorization_id,
-- is_provisional) — terapeuta, sala, horário e disciplina do slot
-- permanecem os mesmos, exatamente como "trocar quem senta em cada
-- cadeira" sem mudar as cadeiras. security definer + guarda explícita de
-- papel (mesmo padrão de confirm_attendance,
-- 20260904000030_family_confirm_attendance.sql), porque a policy comum de
-- UPDATE em appointments não restringe QUAIS colunas mudam — abrir a
-- policy deixaria qualquer terapeuta reatribuir sala/horário também.
create function swap_appointment_patients(p_appointment_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  n int := coalesce(array_length(p_appointment_ids, 1), 0);
  ids uuid[];
  pats uuid[];
  auths uuid[];
  provisionals boolean[];
  statuses text[];
  i int;
  prev int;
begin
  if app_current_role() not in ('supervisor', 'gestor') then
    raise exception 'Sem permissão para permutar agendamentos.';
  end if;

  if n not in (2, 3) then
    raise exception 'Selecione 2 ou 3 agendamentos para permutar.';
  end if;

  if (select count(distinct x) from unnest(p_appointment_ids) x) <> n then
    raise exception 'Selecione agendamentos distintos.';
  end if;

  -- FOR UPDATE não pode combinar com função de agregação na mesma consulta
  -- ("FOR UPDATE is not allowed with aggregate functions") — trava as linhas
  -- num CTE à parte e só agrega (com ORDER BY explícito, já que array_agg
  -- sem ele não garante ordem) na consulta de fora.
  with locked as (
    select a.id, a.patient_id, a.authorization_id, a.is_provisional, a.status, t.ord
    from unnest(p_appointment_ids) with ordinality as t(id, ord)
    join appointments a on a.id = t.id
    join patients pt on pt.id = a.patient_id and pt.clinic_id = current_clinic_id()
    for update of a
  )
  select array_agg(id order by ord), array_agg(patient_id order by ord),
         array_agg(authorization_id order by ord), array_agg(is_provisional order by ord),
         array_agg(status order by ord)
    into ids, pats, auths, provisionals, statuses
  from locked;

  if coalesce(array_length(ids, 1), 0) <> n then
    raise exception 'Um ou mais agendamentos não foram encontrados.';
  end if;

  if exists (select 1 from unnest(statuses) s where s not in ('agendada', 'confirmada')) then
    raise exception 'Só é possível permutar sessões agendadas ou confirmadas (não realizadas nem canceladas).';
  end if;

  for i in 1..n loop
    prev := ((i - 2 + n) % n) + 1;
    update appointments
    set patient_id = pats[prev],
        authorization_id = auths[prev],
        is_provisional = provisionals[prev]
    where id = ids[i];
  end loop;
end;
$$;

revoke execute on function swap_appointment_patients(uuid[]) from public, anon;
grant execute on function swap_appointment_patients(uuid[]) to authenticated;
