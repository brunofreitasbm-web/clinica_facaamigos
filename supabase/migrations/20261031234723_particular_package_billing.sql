-- Faturamento particular pelo valor do PACOTE (global, igual para qualquer terapia).
--
-- Antes: o job mensal (generate_package_invoices) calculava unit_price x sessions_per_month
-- e ignorava contratos sem esses dois campos, que é o caso dos contratos criados pela tela
-- (/gestor/contratos só gravava monthly_fee). Já a fatura manual usava monthly_fee. Agora as
-- duas rotas cobram a mensalidade do pacote (patient_contracts.monthly_fee), que a tela passa
-- a preencher a partir do catálogo de planos (insurer_price_tables, PART-PLANO-*).
--
-- A sessão avulsa (plano Encontro) continua cobrada por sessão; seu preço é global: R$ 190
-- para qualquer especialidade, o mesmo da tabela do convênio Particular.
create or replace function public.generate_package_invoices(
  p_month date default (date_trunc('month', (now() at time zone 'America/Sao_Paulo')))::date
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
  v_due_date date;
  v_created int := 0;
  v_amount numeric(10,2);
begin
  for c in
    select id, monthly_fee, unit_price, sessions_per_month, invoice_day
    from patient_contracts
    where status = 'ativo' and billing_mode = 'pacote'
      and (monthly_fee > 0 or (unit_price is not null and sessions_per_month is not null))
  loop
    -- Valor do pacote; só cai no cálculo antigo se a mensalidade estiver zerada.
    v_amount := case when c.monthly_fee > 0 then c.monthly_fee else c.unit_price * c.sessions_per_month end;
    v_due_date := least(
      (date_trunc('month', p_month) + (c.invoice_day - 1) * interval '1 day')::date,
      (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date
    );

    insert into contract_invoices (contract_id, due_date, amount, status, reference_month, description)
    values (
      c.id,
      v_due_date,
      v_amount,
      'pendente',
      date_trunc('month', p_month)::date,
      case
        when c.sessions_per_month is not null
          then 'Pacote mensal — ' || c.sessions_per_month || ' sessões — ' || to_char(p_month, 'MM/YYYY')
        else 'Pacote mensal — ' || to_char(p_month, 'MM/YYYY')
      end
    )
    on conflict (contract_id, reference_month) where reference_month is not null do nothing;

    if found then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$function$;

-- Sessão avulsa: preço global (R$ 190, plano Encontro), sem diferença por especialidade.
update specialty_prices set price = 190 where active and price <> 190;
