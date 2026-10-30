-- Mescla dois cadastros do MESMO paciente (duplicidade) num só.
--
-- Por que existe: o mesmo responsável/telefone/nascimento/criança entrava por
-- caminhos diferentes (bot de WhatsApp, rascunho validado, cadastro presencial)
-- e virava 2-3 `patients`, cada um numa etapa do fluxo (caso Sophia Amorim: o
-- rascunho com a dispensa de guia estava num cadastro, a oferta de avaliação e a
-- consulta noutro). A guia/habilitação/oferta/agendamento precisam estar no
-- cadastro que fica.
--
-- merge_duplicate_patients(keep, drop):
--   * `keep` é escolhido pelo app (o mais avançado no fluxo) — aqui só se executa;
--   * TODA FK que aponta para patients (e para guardians) é descoberta no catálogo
--     e religada para `keep` — tabela nova no futuro entra sozinha;
--   * linhas que colidem em índice único (mesmo arquivo, mesma etapa...) não somem
--     às cegas: só as tabelas da lista abaixo aceitam descartar a linha de `drop`;
--     em qualquer outra a função desfaz tudo e devolve o motivo;
--   * responsável repetido (mesmo telefone ou CPF) vira um só;
--   * campos em branco de `keep` são preenchidos com os de `drop`;
--   * a linha de `drop` é gravada em audit_log (action MERGE) antes de ser apagada.
-- Só service_role executa (Server Actions/webhook usam createAdminClient).

create or replace function merge_duplicate_patients(p_keep uuid, p_drop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep patients%rowtype;
  v_drop patients%rowtype;
  v_fk record;
  v_col record;
  v_g record;
  v_gk uuid;
  v_moved jsonb := '{}'::jsonb;
  v_n int;
  v_digits text;
  v_cols text[] := '{}';
  -- tabelas em que, numa colisão de índice único, a linha de `drop` é redundante
  v_discardable constant text[] := array[
    'documents', 'intake_steps', 'nps_surveys', 'reassessment_alerts',
    'socially_savvy_assessments', 'survey_responses', 'evaluation_offers'
  ];
begin
  if p_keep is null or p_drop is null or p_keep = p_drop then
    return jsonb_build_object('success', false, 'error', 'Pacientes inválidos.');
  end if;

  select * into v_keep from patients where id = p_keep for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Paciente que fica não encontrado.'); end if;
  select * into v_drop from patients where id = p_drop for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Paciente duplicado não encontrado.'); end if;
  if v_keep.clinic_id is distinct from v_drop.clinic_id then
    return jsonb_build_object('success', false, 'error', 'Pacientes de clínicas diferentes.');
  end if;

  -- 1) Oferta de avaliação viva dos dois: fica a de `keep`; a de `drop` é cancelada
  --    (o índice evaluation_offers_one_active_per_patient só admite uma).
  if exists (select 1 from evaluation_offers where patient_id = p_keep
              and status in ('aguardando_interesse', 'aguardando_escolha', 'aguardando_supervisor')) then
    update evaluation_offers set status = 'cancelado'
     where patient_id = p_drop and status in ('aguardando_interesse', 'aguardando_escolha', 'aguardando_supervisor');
  end if;

  -- 2) Responsáveis repetidos (mesmo CPF ou mesmos 8 últimos dígitos do telefone).
  for v_g in select * from guardians where patient_id = p_drop loop
    v_digits := right(regexp_replace(coalesce(v_g.phone, ''), '\D', '', 'g'), 8);
    select k.id into v_gk
      from guardians k
     where k.patient_id = p_keep
       and ((v_g.cpf is not null and k.cpf = v_g.cpf)
         or (length(v_digits) = 8 and right(regexp_replace(coalesce(k.phone, ''), '\D', '', 'g'), 8) = v_digits))
     order by k.is_financial desc
     limit 1;
    if v_gk is not null then
      for v_fk in
        select c.conrelid::regclass::text as tbl, a.attname as col
          from pg_constraint c
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
         where c.contype = 'f' and c.confrelid = 'public.guardians'::regclass
      loop
        begin
          execute format('update %s set %I = $1 where %I = $2', v_fk.tbl, v_fk.col, v_fk.col) using v_gk, v_g.id;
        exception when unique_violation then
          execute format('delete from %s where %I = $1', v_fk.tbl, v_fk.col) using v_g.id;
        end;
      end loop;
      update guardians k set
        email = coalesce(k.email, v_g.email),
        cpf = coalesce(k.cpf, v_g.cpf),
        rg = coalesce(k.rg, v_g.rg),
        phone = coalesce(k.phone, v_g.phone),
        full_name = case when k.full_name in ('Responsável', 'Responsável (contato WhatsApp)') then v_g.full_name else k.full_name end
       where k.id = v_gk;
      delete from guardians where id = v_g.id;
    else
      -- Responsável só de `drop`: vira responsável de `keep` (o contato de emergência
      -- é único por paciente — o de `keep` prevalece).
      update guardians set patient_id = p_keep, is_emergency_contact = false where id = v_g.id;
    end if;
    v_gk := null;
  end loop;

  -- 3) Religa todas as demais FKs de patients.
  for v_fk in
    select c.conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
     where c.contype = 'f' and c.confrelid = 'public.patients'::regclass
       and c.conrelid <> 'public.patients'::regclass
  loop
    begin
      execute format('update %s set %I = $1 where %I = $2', v_fk.tbl, v_fk.col, v_fk.col) using p_keep, p_drop;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_moved := v_moved || jsonb_build_object(v_fk.tbl || '.' || v_fk.col, v_n); end if;
    exception when unique_violation then
      if split_part(v_fk.tbl, '.', 2) = any(v_discardable) or v_fk.tbl = any(v_discardable) then
        -- etapa já concluída em `drop` e não em `keep`: leva o andamento antes de descartar.
        if v_fk.tbl = 'intake_steps' then
          update intake_steps k set status = d.status, completed_at = d.completed_at, completed_by = d.completed_by
            from intake_steps d
           where k.patient_id = p_keep and d.patient_id = p_drop and k.step_key = d.step_key
             and k.completed_at is null and d.completed_at is not null;
        end if;
        -- linha a linha: move o que não colide, descarta só o que colide.
        for v_col in execute format('select ctid::text as rid from %s where %I = $1', v_fk.tbl, v_fk.col) using p_drop loop
          begin
            execute format('update %s set %I = $1 where ctid = $2::tid', v_fk.tbl, v_fk.col) using p_keep, v_col.rid;
          exception when unique_violation then
            execute format('delete from %s where ctid = $1::tid', v_fk.tbl) using v_col.rid;
          end;
        end loop;
      else
        return jsonb_build_object('success', false,
          'error', 'Conflito de unicidade em ' || v_fk.tbl || '.' || v_fk.col || ' — mesclagem não feita.');
      end if;
    end;
  end loop;

  -- 4) Campos em branco de `keep` ganham o valor de `drop` (nunca sobrescreve).
  for v_col in
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'patients'
       and column_name not in ('id', 'clinic_id', 'status', 'created_at', 'updated_at', 'full_name')
  loop
    v_cols := v_cols || v_col.column_name;
  end loop;
  foreach v_digits in array v_cols loop
    begin
      execute format(
        'update patients k set %1$I = d.%1$I from patients d where k.id = $1 and d.id = $2 and k.%1$I is null and d.%1$I is not null',
        v_digits) using p_keep, p_drop;
    exception when unique_violation then
      null; -- ex.: CPF que já existe em outro cadastro — não força.
    end;
  end loop;
  -- Nome mais completo (mesmo primeiro nome) vence: "Sophia Amorim" -> "Sophia Amorim Pastana da Costa".
  update patients set full_name = v_drop.full_name
   where id = p_keep
     and length(trim(v_drop.full_name)) > length(trim(v_keep.full_name))
     and lower(split_part(trim(v_drop.full_name), ' ', 1)) = lower(split_part(trim(v_keep.full_name), ' ', 1));

  -- 5) Trilha e remoção do duplicado.
  insert into audit_log (table_name, row_id, action, clinic_id, before, after)
  values ('patients', p_drop, 'MERGE', v_drop.clinic_id, to_jsonb(v_drop),
          jsonb_build_object('merged_into', p_keep, 'moved', v_moved));

  delete from patients where id = p_drop;

  return jsonb_build_object('success', true, 'kept', p_keep, 'dropped', p_drop, 'moved', v_moved);
exception
  when foreign_key_violation then
    return jsonb_build_object('success', false, 'error', 'Ainda há registros vinculados ao duplicado — mesclagem desfeita.');
end;
$$;

revoke all on function merge_duplicate_patients(uuid, uuid) from public, anon, authenticated;
grant execute on function merge_duplicate_patients(uuid, uuid) to service_role;
