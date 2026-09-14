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
--
-- A agenda de sessões/terapias nasce do PTS (discipline_mix do plano
-- aprovado, ver treatment_plans.discipline_mix e app/supervisao/planos/novo)
-- — como a disciplina do slot NÃO muda na permuta, um paciente só pode
-- entrar num slot cuja disciplina o PTS aprovado dele já prevê. Sem essa
-- checagem, a permuta colocaria a criança numa terapia que o plano dela
-- nem pede (ex.: slot de Fono recebendo um paciente cujo PTS só tem ABA).
create function swap_appointment_patients(p_appointment_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  n int := coalesce(array_length(p_appointment_ids, 1), 0);
  ids uuid[];
  pats uuid[];
  auths uuid[];
  provisionals boolean[];
  statuses text[];
  disciplines text[];
  new_patient uuid;
  new_discipline text;
  has_matching_pts boolean;
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
    select a.id, a.patient_id, a.authorization_id, a.is_provisional, a.status, a.discipline, t.ord
    from unnest(p_appointment_ids) with ordinality as t(id, ord)
    join appointments a on a.id = t.id
    join patients pt on pt.id = a.patient_id and pt.clinic_id = current_clinic_id()
    for update of a
  )
  select array_agg(id order by ord), array_agg(patient_id order by ord),
         array_agg(authorization_id order by ord), array_agg(is_provisional order by ord),
         array_agg(status order by ord), array_agg(discipline order by ord)
    into ids, pats, auths, provisionals, statuses, disciplines
  from locked;

  if coalesce(array_length(ids, 1), 0) <> n then
    raise exception 'Um ou mais agendamentos não foram encontrados.';
  end if;

  if exists (select 1 from unnest(statuses) s where s not in ('agendada', 'confirmada')) then
    raise exception 'Só é possível permutar sessões agendadas ou confirmadas (não realizadas nem canceladas).';
  end if;

  -- nps_surveys.patient_id/guardian_id são colunas próprias, não derivadas de
  -- appointments.patient_id (20260906000011_nps_surveys.sql) — não ficam em
  -- sincronia sozinhas se a sessão já tiver disparado pesquisa (o que na
  -- prática não deveria acontecer pra 'agendada'/'confirmada', mas o guard
  -- acima só olha status, não isso; melhor barrar explicitamente do que
  -- deixar uma pesquisa de satisfação ir pro paciente errado).
  if exists (select 1 from nps_surveys where appointment_id = any(ids)) then
    raise exception 'Uma dessas sessões já tem pesquisa de satisfação vinculada — não é possível permutar.';
  end if;

  -- Cada paciente que vai OCUPAR um slot precisa ter, no PTS aprovado dele,
  -- a disciplina daquele slot — a disciplina do slot não muda na permuta,
  -- só quem senta nela.
  for i in 1..n loop
    prev := ((i - 2 + n) % n) + 1;
    new_patient := pats[prev];
    new_discipline := disciplines[i];

    select exists (
      select 1 from treatment_plans tp
      where tp.patient_id = new_patient
        and tp.status = 'aprovado'
        and tp.discipline_mix ? new_discipline
    ) into has_matching_pts;

    if not has_matching_pts then
      raise exception 'O PTS aprovado de um dos pacientes não prevê a disciplina "%" — permuta bloqueada.', new_discipline;
    end if;
  end loop;

  for i in 1..n loop
    prev := ((i - 2 + n) % n) + 1;
    update appointments
    set patient_id = pats[prev],
        authorization_id = auths[prev],
        is_provisional = provisionals[prev]
    where id = ids[i];
  end loop;

  -- O evento espelhado no Google Calendar (supabase/functions/sync-google-calendar)
  -- é construído com o nome do paciente/responsável de quando foi sincronizado —
  -- marca como 'pending' pra o reconciliador (app/api/google-calendar/reconcile)
  -- atualizar o card com o paciente novo, em vez de deixar o nome antigo lá.
  update appointments
  set google_calendar_sync_status = 'pending'
  where id = any(ids);
end;
$$;

revoke execute on function swap_appointment_patients(uuid[]) from public, anon;
grant execute on function swap_appointment_patients(uuid[]) to authenticated;
