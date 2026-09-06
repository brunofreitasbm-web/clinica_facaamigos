-- supabase/migrations/20260906000018_close_monthly_payouts.sql
--
-- Automatiza o fechamento mensal de repasses (app/faturamento/repasses/actions.ts
-- `closePayouts`), que hoje só roda quando um humano do faturamento entra na
-- tela e clica em "Fechar competência". Isso já aconteceu de ser esquecido em
-- meses passados. Este job replica EXATAMENTE a mesma regra de agregação da
-- action manual (terapeuta ativo da clínica com pelo menos 1 sessão
-- `realizada` no mês, taxa aplicada = `therapist_contracts.hourly_rate`
-- vigente NA DATA de cada sessão) e roda como uma função irmã, agendada no
-- MESMO horário do job de fechamento de métricas (`close_monthly_metric_snapshots`,
-- dia 1 às 3h, ver 20260904000027) — job separado em vez de anexar dentro de
-- `close_monthly_metric_snapshots()` para não arriscar quebrar um cron que já
-- funciona: se o cálculo de payouts falhar por algum motivo, o fechamento de
-- métricas (que já está em produção) continua rodando normalmente, e vice-versa.
--
-- SEGURANÇA FINANCEIRA (não negociável): igual à criação manual, todo payout
-- gerado por este job nasce em status='aberto' — o mesmo default da tabela
-- (20260904000010_payouts.sql) e o mesmo valor que a inserção manual sempre
-- usou. NUNCA 'aprovado' nem 'pago'. Um humano do faturamento continua tendo
-- que revisar e aprovar cada payout em /faturamento/repasses antes de
-- qualquer pagamento sair — este job só elimina o trabalho de "lembrar de
-- clicar em gerar", não a revisão humana. Um payout já 'aprovado'/'pago' é
-- IGNORADO pelo job (nunca sobrescrito), exatamente como na action manual.
create function close_monthly_payouts() returns void
language plpgsql security definer set search_path = public as $$
declare
  clinic_row record;
  therapist_row record;
  period_start date := date_trunc('month', now() - interval '1 month')::date;
  period_end date := date_trunc('month', now())::date;
  existing_payout record;
  v_payout_id uuid;
  v_sessions_count int;
  v_gross_amount numeric;
begin
  for clinic_row in select id from clinics loop

    -- Terapeuta ativo da clínica — mesmo filtro de app/faturamento/repasses/actions.ts.
    for therapist_row in
      select id from profiles
      where clinic_id = clinic_row.id and role = 'terapeuta' and active = true
    loop

      -- Mesma regra de rateAt(): para cada sessão `realizada` no mês, usa a
      -- faixa de therapist_contracts vigente NA DATA da sessão (valid_from
      -- <= starts_at <= valid_to, ou sem valid_to). O `exclude using gist`
      -- em therapist_contracts (20260904000001) garante no máximo uma faixa
      -- vigente por terapeuta em qualquer instante, então o "limit 1" da
      -- lateral nunca precisa desempatar. Sessão sem contrato vigente na
      -- data fica de fora da soma, igual ao `if (rate == null) continue;`
      -- da action manual — o join lateral (sem LEFT) já descarta essas linhas.
      select count(*), coalesce(sum(extract(epoch from (a.ends_at - a.starts_at)) / 3600.0 * tc.hourly_rate), 0)
      into v_sessions_count, v_gross_amount
      from appointments a
      join lateral (
        select c.hourly_rate
        from therapist_contracts c
        where c.profile_id = a.therapist_id
          and c.valid_from <= a.starts_at
          and (c.valid_to is null or c.valid_to >= a.starts_at)
        limit 1
      ) tc on true
      where a.therapist_id = therapist_row.id
        and a.status = 'realizada'
        and a.starts_at >= period_start and a.starts_at < period_end;

      if v_sessions_count is null or v_sessions_count = 0 then
        continue; -- nenhuma sessão com contrato vigente no mês: terapeuta fica de fora (igual ao `skipped` da action manual)
      end if;

      select id, status into existing_payout
      from payouts
      where therapist_id = therapist_row.id and competence_month = period_start;

      if found and existing_payout.status <> 'aberto' then
        continue; -- já aprovado/pago: nunca sobrescreve, igual à action manual
      end if;

      if found then
        update payouts set sessions_count = v_sessions_count, gross_amount = v_gross_amount
        where id = existing_payout.id;
        v_payout_id := existing_payout.id;
        delete from payout_items where payout_id = v_payout_id;
      else
        -- Nasce sempre 'aberto' (default da coluna, explícito aqui por clareza) —
        -- nunca 'aprovado' nem 'pago'. Aprovação/pagamento continuam 100% manuais.
        insert into payouts (therapist_id, competence_month, sessions_count, gross_amount, status)
        values (therapist_row.id, period_start, v_sessions_count, v_gross_amount, 'aberto')
        returning id into v_payout_id;
      end if;

      insert into payout_items (payout_id, appointment_id, rate_applied)
      select v_payout_id, a.id, tc.hourly_rate
      from appointments a
      join lateral (
        select c.hourly_rate
        from therapist_contracts c
        where c.profile_id = a.therapist_id
          and c.valid_from <= a.starts_at
          and (c.valid_to is null or c.valid_to >= a.starts_at)
        limit 1
      ) tc on true
      where a.therapist_id = therapist_row.id
        and a.status = 'realizada'
        and a.starts_at >= period_start and a.starts_at < period_end;

    end loop;
  end loop;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'close_monthly_payouts',
    '0 3 1 * *',
    $job$select close_monthly_payouts();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende close_monthly_payouts() externamente. %', sqlerrm;
end;
$$;
