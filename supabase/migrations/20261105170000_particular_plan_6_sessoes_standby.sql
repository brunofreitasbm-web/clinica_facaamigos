-- Plano particular "6 sessões/mês" (R$ 1.080,00) — DORMENTE (standby).
--
-- Insere a linha PART-PLANO-PASSO-FIRME no convênio "Particular", no mesmo padrão das
-- demais PART-PLANO-* (Encontro, Primeiro Passo, Laço, Vínculo, Turma, Abraço, Voo Livre),
-- porém com valid_from numa data SENTINELA futura (2099-01-01). Como parsePlanRows
-- (lib/particular-plans-pure.ts) só aceita valid_from <= hoje, o plano NÃO aparece:
--   - no menu/valores do WhatsApp (lib/welcome-menu.ts),
--   - no prompt da IA (buildParticularPricesBlock filtra vigência),
--   - no seletor de pacote de /gestor/contratos nem em createContract.
-- Nada de código muda: o catálogo continua dinâmico (sessões vêm de "N sess..." na observação).
--
-- >>> PONTO ÚNICO DE CONFIGURAÇÃO DO NOME <<<
-- 'Passo Firme' é PROVISÓRIO. Altere somente o campo `name` ('Plano ...') no VALUES abaixo
-- (antes de aplicar) ou, depois de aplicada, com:
--   update public.insurer_price_tables set procedure_name = 'Plano <NOVO NOME>'
--    where procedure_code = 'PART-PLANO-PASSO-FIRME'
--      and insurer_id = (select id from public.insurers where name = 'Particular');
-- O código (PART-PLANO-PASSO-FIRME) é interno e NÃO precisa mudar: contratos gravam
-- sessions_per_month/unit_price/monthly_fee, não o código do plano.
--
-- ATIVAÇÃO (um único comando; vale a partir de hoje):
--   update public.insurer_price_tables set valid_from = current_date
--    where procedure_code = 'PART-PLANO-PASSO-FIRME'
--      and insurer_id = (select id from public.insurers where name = 'Particular');
--
-- DESATIVAÇÃO (volta a ficar dormente; contratos já criados seguem com o valor gravado):
--   update public.insurer_price_tables set valid_from = date '2099-01-01'
--    where procedure_code = 'PART-PLANO-PASSO-FIRME'
--      and insurer_id = (select id from public.insurers where name = 'Particular');
--
-- Antes de ativar, siga docs/superpowers/specs/2026-11-05-pacote-6-sessoes-activation-runbook.md
-- (a imagem de valores do WhatsApp e a KB do chatbot precisam ser atualizadas na mesma hora).

insert into public.insurer_price_tables (
  insurer_id, procedure_code, procedure_name, price, duration_minutes,
  requires_prior_authorization, max_sessions_per_guide, session_frequency_note,
  valid_from
)
select i.id, v.code, v.name, v.price, null, false, null, v.note, date '2099-01-01'
from public.insurers i
cross join (values
  ('PART-PLANO-PASSO-FIRME', 'Plano Passo Firme', 1080.00,
   '6 sessões/mês; terapias combináveis; avaliação inicial conta como 1 sessão; bloco ABA = 3 sessões')
) as v(code, name, price, note)
where i.name = 'Particular'
  and not exists (
    select 1 from public.insurer_price_tables p
    where p.insurer_id = i.id and p.procedure_code = v.code
  );
