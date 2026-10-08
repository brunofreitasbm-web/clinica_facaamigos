-- supabase/migrations/20261008120200_bound_grade_recurrence_horizon.sql
--
-- Bug confirmado (incidente de Disk I/O 2026-10-08): regenerate_active_grade_sessions(8)
-- (20260906000017) chama generate_from_recurrence_anchor(rec, 8), que ancora
-- na sessão MAIS RECENTE não cancelada da série (order by starts_at desc) e
-- gera 8 semanas a partir de anchor + 7 dias. Como o cron roda todo dia às
-- 04:00, a âncora é sempre a última sessão já gerada: o horizonte avançava
-- 8 semanas A CADA DIA, sem limite — appointments crescia para sempre
-- (com audit_log gravando 2 cópias JSON de cada INSERT).
--
-- Correção: o cron só gera até hoje + p_weeks_ahead semanas (data civil de
-- America/Sao_Paulo). generate_from_recurrence_anchor NÃO muda: o botão manual
-- "gerar mais semanas" (lib/grade-recurrence.ts generateSeriesSessions)
-- continua estendendo a partir da última sessão por pedido explícito do usuário.
-- Não apaga nada: o excesso já gerado é tratado manualmente (ver runbook).
-- Assinatura e grants preservados (create or replace).
create or replace function regenerate_active_grade_sessions(p_weeks_ahead int default 8) returns void
language plpgsql security definer set search_path = public as $$
declare
  rec record;
  horizon date := (now() at time zone 'America/Sao_Paulo')::date + (p_weeks_ahead * 7);
  weeks_missing int;
begin
  for rec in
    select a.recurrence_id,
           (max(a.starts_at) at time zone 'America/Sao_Paulo')::date as last_date
    from appointments a
    where a.recurrence_id is not null
      and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
    group by a.recurrence_id
    having max(a.starts_at) >= now() - interval '14 days'
  loop
    -- Próximas ocorrências caem em last_date + 7k; só vale k com last_date + 7k <= horizon.
    weeks_missing := (horizon - rec.last_date) / 7;
    if weeks_missing <= 0 then
      continue; -- série já cobre o horizonte
    end if;
    begin
      perform * from generate_from_recurrence_anchor(rec.recurrence_id, least(weeks_missing, p_weeks_ahead));
    exception when others then
      raise warning 'regenerate_active_grade_sessions: falhou para recurrence_id %: %', rec.recurrence_id, sqlerrm;
    end;
  end loop;
end;
$$;
