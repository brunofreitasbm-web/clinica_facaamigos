-- Reescreve o fechamento mensal de repasse para honorários por Módulo
-- Assistencial (cláusula 6ª do contrato-quadro PJ–PJ), usando
-- compute_assistance_modules() como fonte de verdade única. Mantém
-- close_monthly_payouts() com a MESMA assinatura (sem argumentos) para não
-- quebrar o cron.schedule já registrado (20260906000018) — ela agora só
-- delega pro mês anterior via a nova variante parametrizada, que a action
-- manual (app/faturamento/repasses/actions.ts) também passa a chamar via
-- RPC, eliminando a duplicação de lógica SQL/TS que existia no modelo por
-- hora.
--
-- Contratos ainda no modelo legado por hora (hourly_rate preenchido,
-- module_price nulo — não deveria sobrar nenhum após a migração completa
-- da tela de cadastro, mas por segurança durante a transição) caem no ramo
-- antigo, idêntico ao close_monthly_payouts() original.
--
-- SECURITY DEFINER necessário pra gravar em payouts/payout_items (RLS de
-- escrita é só-gestor). Esta variante interna NÃO tem guard de papel — é
-- chamada tanto pelo pg_cron (sem sessão autenticada; app_current_role()
-- resolveria null ali, então um guard aqui quebraria o job mensal) quanto
-- pelo wrapper autenticado abaixo, que faz a checagem de papel antes de
-- delegar pra cá.
create or replace function close_monthly_payouts_for_month(p_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clinic_row record;
  therapist_row record;
  period_start date := date_trunc('month', p_month)::date;
  period_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  existing_payout record;
  v_contract record;
  v_payout_id uuid;
  v_modules_delivered int;
  v_modules_emptied int;
  v_gross numeric;
  v_indemnity numeric;
  v_legacy_sessions int;
  v_legacy_gross numeric;
begin
  for clinic_row in select id from clinics loop
    for therapist_row in
      select id from profiles
      where clinic_id = clinic_row.id and role = 'terapeuta' and active = true
    loop
      -- Contrato vigente no primeiro dia do mês de competência (mesma regra
      -- de "vigente na data" já usada pelo modelo por hora, aplicada aqui
      -- ao mês inteiro em vez de sessão a sessão, pois o preço do módulo é
      -- fixo por competência).
      select c.module_price, c.noshow_compensation_pct, c.hourly_rate
      into v_contract
      from therapist_contracts c
      where c.profile_id = therapist_row.id
        and c.valid_from <= period_start
        and (c.valid_to is null or c.valid_to >= period_start)
      limit 1;

      if not found then
        continue; -- sem contrato vigente no mês: terapeuta fica de fora
      end if;

      select id, status into existing_payout
      from payouts
      where therapist_id = therapist_row.id and competence_month = period_start;

      if found and existing_payout.status <> 'aberto' then
        continue; -- já aprovado/pago: nunca sobrescreve
      end if;

      if v_contract.module_price is not null then
        -- ── Módulo Assistencial ──────────────────────────────────────
        select
          coalesce(count(*) filter (where delivered), 0)::int,
          coalesce(count(*) filter (where emptied_by_noshow), 0)::int
        into v_modules_delivered, v_modules_emptied
        from compute_assistance_modules(array[therapist_row.id], period_start, period_end);

        if v_modules_delivered = 0 and v_modules_emptied = 0 then
          continue; -- nenhum módulo entregue nem indenizável no mês
        end if;

        v_gross := v_modules_delivered * v_contract.module_price;
        v_indemnity := v_modules_emptied * v_contract.module_price * (v_contract.noshow_compensation_pct / 100.0);

        if found then
          update payouts set
            sessions_count = v_modules_delivered,
            modules_delivered_count = v_modules_delivered,
            modules_emptied_noshow_count = v_modules_emptied,
            gross_amount = v_gross,
            indemnity_amount = v_indemnity
          where id = existing_payout.id;
          v_payout_id := existing_payout.id;
          delete from payout_items where payout_id = v_payout_id;
        else
          insert into payouts (
            therapist_id, competence_month, sessions_count, gross_amount,
            modules_delivered_count, modules_emptied_noshow_count, indemnity_amount, status
          )
          values (
            therapist_row.id, period_start, v_modules_delivered, v_gross,
            v_modules_delivered, v_modules_emptied, v_indemnity, 'aberto'
          )
          returning id into v_payout_id;
        end if;

        insert into payout_items (payout_id, item_type, service_date, period, module_price_applied, appointment_ids)
        select v_payout_id, 'modulo', m.service_date, m.period, v_contract.module_price, m.appointment_ids
        from compute_assistance_modules(array[therapist_row.id], period_start, period_end) m
        where m.delivered;

        insert into payout_items (payout_id, item_type, service_date, period, module_price_applied, appointment_ids)
        select
          v_payout_id, 'indenizacao_noshow', m.service_date, m.period,
          v_contract.module_price * (v_contract.noshow_compensation_pct / 100.0), m.appointment_ids
        from compute_assistance_modules(array[therapist_row.id], period_start, period_end) m
        where m.emptied_by_noshow;

      else
        -- ── Legado por hora (transição) ──────────────────────────────
        select count(*), coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 3600.0 * v_contract.hourly_rate), 0)
        into v_legacy_sessions, v_legacy_gross
        from appointments a
        where a.therapist_id = therapist_row.id
          and a.status = 'realizada'
          and a.starts_at >= period_start and a.starts_at < period_end;

        if v_legacy_sessions is null or v_legacy_sessions = 0 then
          continue;
        end if;

        if found then
          update payouts set sessions_count = v_legacy_sessions, gross_amount = v_legacy_gross
          where id = existing_payout.id;
          v_payout_id := existing_payout.id;
          delete from payout_items where payout_id = v_payout_id;
        else
          insert into payouts (therapist_id, competence_month, sessions_count, gross_amount, status)
          values (therapist_row.id, period_start, v_legacy_sessions, v_legacy_gross, 'aberto')
          returning id into v_payout_id;
        end if;

        insert into payout_items (payout_id, item_type, appointment_id, rate_applied)
        select v_payout_id, 'sessao', a.id, v_contract.hourly_rate
        from appointments a
        where a.therapist_id = therapist_row.id
          and a.status = 'realizada'
          and a.starts_at >= period_start and a.starts_at < period_end;
      end if;

    end loop;
  end loop;
end;
$$;

-- Só o pg_cron (via close_monthly_payouts(), abaixo) e o wrapper autenticado
-- chamam a função interna diretamente — nenhum usuário comum deve invocá-la
-- sem a checagem de papel do wrapper.
revoke all on function close_monthly_payouts_for_month(date) from public;
revoke all on function close_monthly_payouts_for_month(date) from authenticated;

-- Wrapper chamado via RPC pela action manual
-- (app/faturamento/repasses/actions.ts) — único ponto de entrada exposto a
-- usuários autenticados, com checagem de papel (gestor/faturamento) antes
-- de delegar pra close_monthly_payouts_for_month().
create or replace function close_payouts_for_month_authenticated(p_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- coalesce pro caso app_current_role() vir null (sem profile/sessão
  -- resolvida) — "null not in (...)" avalia null, não true, e um IF com
  -- condição null NÃO dispara o THEN em plpgsql, deixando o guard passar
  -- batido sem isso.
  if coalesce((select app_current_role()), '') not in ('gestor', 'faturamento') then
    raise exception 'Sem permissão para fechar competência de repasse.';
  end if;

  perform close_monthly_payouts_for_month(p_month);
end;
$$;

revoke all on function close_payouts_for_month_authenticated(date) from public;
grant execute on function close_payouts_for_month_authenticated(date) to authenticated;

-- Mantém a assinatura original (sem args) pro cron.schedule já registrado
-- (20260906000018) continuar funcionando sem precisar reagendar.
create or replace function close_monthly_payouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem guard de papel aqui: só o pg_cron chama esta variante (mesmo
  -- comportamento de antes), então delega direto sem checar app_current_role().
  perform close_monthly_payouts_for_month((date_trunc('month', now() - interval '1 month'))::date);
end;
$$;
