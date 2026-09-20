-- Tabela de preços do "Particular", cadastrado como se fosse um convênio
-- (insurers.name = 'Particular'), só que sem guia: requires_prior_authorization = false.
-- Diferente dos convênios, aqui o valor É cobrado diretamente do cliente.
-- Valores informados pela clínica em 2026-09-17 (mesmos de specialty_prices):
--   ABA (Psicologia, Fono, TO), Integração Sensorial, Musicoterapia, Psicomotricidade: R$ 200
--   Psicoterapia, Fono Convencional, TO Convencional: R$ 150
-- Duração: 40 min para todos os atendimentos; única exceção é o Treino ABA
-- (3 blocos de 40 min), que ainda não tem valor particular definido.
-- Códigos PART-* são internos (particular não tem código TUSS de operadora).

insert into public.insurer_price_tables (
  insurer_id, procedure_code, procedure_name, price, duration_minutes,
  requires_prior_authorization, max_sessions_per_guide, session_frequency_note,
  valid_from
)
select i.id, v.code, v.name, v.price, 40, false, null, v.note, date '2026-09-17'
from public.insurers i
cross join (values
  ('PART-PSI-ABA',   'Psicologia ABA',                   200.00, null),
  ('PART-FONO-ABA',  'Fonoaudiologia ABA',               200.00, null),
  ('PART-TO-ABA',    'Terapia Ocupacional ABA',          200.00, null),
  ('PART-PSICOTER',  'Psicoterapia',                     150.00, 'Exceção: modalidade convencional tem valor reduzido (R$ 150); demais especialidades R$ 200.'),
  ('PART-FONO-CONV', 'Fonoaudiologia Convencional',      150.00, 'Exceção: modalidade convencional tem valor reduzido (R$ 150); demais especialidades R$ 200.'),
  ('PART-TO-CONV',   'Terapia Ocupacional Convencional', 150.00, 'Exceção: modalidade convencional tem valor reduzido (R$ 150); demais especialidades R$ 200.'),
  ('PART-IS',        'Integração Sensorial',             200.00, null),
  ('PART-MUSICO',    'Musicoterapia',                    200.00, null),
  ('PART-PSICOMOT',  'Psicomotricidade',                 200.00, null)
) as v(code, name, price, note)
where i.name = 'Particular'
  and not exists (
    select 1 from public.insurer_price_tables p
    where p.insurer_id = i.id and p.procedure_code = v.code
  );
