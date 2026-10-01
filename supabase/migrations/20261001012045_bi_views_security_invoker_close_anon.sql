-- Views de BI passam a respeitar a RLS de quem consulta (security_invoker) e deixam de ser legíveis pelo anon.
-- Antes: rodavam com permissões do dono, ignorando a RLS das tabelas de base, e o anon tinha todos os privilégios.
-- A DRE do gestor (v_contribution_margin) continua funcionando: as tabelas de base já têm RLS por clínica e por papel.
do $$
declare v text;
begin
  foreach v in array array['v_revenue_per_room_hour','v_contribution_margin','v_insurer_concentration','v_ltv_months','v_payout_ratio'] loop
    execute format('alter view public.%I set (security_invoker = true)', v);
    execute format('revoke all on public.%I from anon', v);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', v);
  end loop;
end $$;
